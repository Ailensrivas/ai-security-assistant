import type { Finding } from "../types";
import { referenceWhy } from "./templates";

/**
 * THE ONLY PLACE where the text sent to the AI is built.
 * Kept as a pure function (no network, no secrets) so a test can check
 * exactly what leaves the app. See request.test.ts.
 *
 * Sent: rule id, severity, count, and two non-identifying facts
 * (kind of access, days without sign-in).
 * Never sent: emails, names, file names, app names, domains, forwarding addresses.
 */

export const SYSTEM_PROMPT = `You explain security findings to the owner of a small business (5–50 people) who is not technical.
For each finding, write one or two sentences on why it matters for this kind of business ("why") and 2–3 concrete steps they can do themselves in the Google Admin console ("steps").
Write every text twice: natural American English ("en") and natural Latin American Spanish ("es"), not a word-for-word translation. In Spanish always address the owner as "tú" (pide, revisa, empieza), never "usted".
Rules:
- Use only the facts in the findings JSON. Do not invent numbers, names, laws or tools.
- The severity and order were decided by the system. Do not contradict or soften them.
- Some findings may be legitimate (for example, forwarding someone authorized, or an admin who really needs access). Always tell the owner to confirm with the person first, and only then remove or turn off the setting. Never tell them to delete or disable something without that check.
- Only mention the kind of access listed in "accessKinds". Do not mention Gmail if only Drive is listed, and so on.
- No jargon. If you must use a term (like "2-Step Verification"), explain it in a few words.
- Keep each "why" under 45 words and each step under 25 words.
- Return one item per finding, with the same ruleId.
- Also write a 1–2 sentence "summary" telling the owner which finding to start with and the first thing to do, following the confirm-first rule above.`;

export interface MinimizedFinding {
  ruleId: Finding["ruleId"];
  severity: Finding["severity"];
  count: number;
  accessKinds?: string[];
  maxInactiveDays?: number | null;
}

export function minimizeFinding(f: Finding): MinimizedFinding {
  const m: MinimizedFinding = { ruleId: f.ruleId, severity: f.severity, count: f.count };
  if (f.ruleId === "RISKY_THIRD_PARTY_APPS") m.accessKinds = f.details.accessKinds ?? [];
  if (f.ruleId === "INACTIVE_ACCOUNTS") m.maxInactiveDays = f.details.maxInactiveDays ?? null;
  return m;
}

/** The user message for the AI. */
export function buildUserMessage(findings: Finding[], score: number): string {
  const minimized = findings.map(minimizeFinding);
  const reference = Object.fromEntries(findings.map((f) => [f.ruleId, referenceWhy(f.ruleId)]));
  return (
    `Security score: ${score}/100.\n` +
    `Findings (JSON):\n${JSON.stringify(minimized, null, 2)}\n\n` +
    `Reference meaning of each rule (stay consistent with it):\n${JSON.stringify(reference, null, 2)}`
  );
}
