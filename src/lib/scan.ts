import "server-only";
import { createHash } from "node:crypto";
import { MODEL, explainFindings, type ExplainResult } from "./ai/explain";
import { SYSTEM_PROMPT, buildUserMessage } from "./ai/request";
import { demoSnapshot } from "./collectors/demo";
import { getCached, purgeOldDemoScans, recentScanCount, saveScan, setCached, simulatedFixRuleIds } from "./db";
import { evaluate, gradeFor, scoreFindings } from "./rules";
import type { Explanation, Finding, RuleId, WorkspaceSnapshot } from "./types";

export type DataSource = "demo" | "google";

/** Public demo limits. */
export const MAX_SCANS_PER_HOUR = 20;
const DEMO_RETENTION_DAYS = 7;

export function dataSource(): DataSource {
  return process.env.DATA_SOURCE === "google" ? "google" : "demo";
}

async function collect(source: DataSource, sessionId: string): Promise<WorkspaceSnapshot> {
  if (source === "google") {
    // Loaded only when needed, so demo mode never touches Google code.
    const { googleSnapshot } = await import("./collectors/google");
    return googleSnapshot();
  }
  // Demo: pretend the owner applied the fixes they marked as pending,
  // so the next check can show "Fixed · simulated verification".
  return demoSnapshot(new Date(), simulatedFixRuleIds(sessionId));
}

interface CachedExplanation {
  explanations: [RuleId, Explanation][];
  summary: { en: string; es: string };
}

/**
 * Same minimized request -> same answer, so we only pay for the AI once.
 * The key is a hash of exactly what would be sent (model + prompt + findings),
 * which contains nothing identifying.
 */
async function explainWithCache(findings: Finding[], score: number): Promise<ExplainResult> {
  const key = createHash("sha256").update(`${MODEL}\n${SYSTEM_PROMPT}\n${buildUserMessage(findings, score)}`).digest("hex");
  const hit = getCached<CachedExplanation>(key);
  if (hit) return { explanations: new Map(hit.explanations), summary: hit.summary, source: "ai" };

  const result = await explainFindings(findings, score);
  if (result.source === "ai") {
    setCached(key, { explanations: [...result.explanations], summary: result.summary } satisfies CachedExplanation);
  }
  return result;
}

export type ScanOutcome = { ok: true; scanId: number } | { ok: false; reason: "rate_limited" };

/** collect -> evaluate (rules) -> explain (AI, cached, or templates) -> store. */
export async function runScan(sessionId: string): Promise<ScanOutcome> {
  const source = dataSource();
  if (source === "demo") {
    purgeOldDemoScans(DEMO_RETENTION_DAYS);
    if (recentScanCount(sessionId, 60) >= MAX_SCANS_PER_HOUR) return { ok: false, reason: "rate_limited" };
  }

  const snapshot = await collect(source, sessionId);
  const findings = evaluate(snapshot);
  const score = scoreFindings(findings);
  const { explanations, summary, source: explanationSource } = await explainWithCache(findings, score);

  const scanId = saveScan({
    sessionId,
    source,
    domain: snapshot.domain,
    organizationName: snapshot.organizationName,
    score,
    grade: gradeFor(score),
    summary,
    findings: findings.map((f) => ({
      finding: f,
      explanation: explanations.get(f.ruleId)!,
      source: explanationSource,
    })),
  });
  return { ok: true, scanId };
}
