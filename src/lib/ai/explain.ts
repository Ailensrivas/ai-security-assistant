import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Explanation, Finding, RuleId } from "../types";
import { SYSTEM_PROMPT, buildUserMessage } from "./request";
import { templateExplanation, templateSummary, titleFor } from "./templates";

export const MODEL = "claude-opus-5-5";

// The AI writes "why" and "steps" only. Titles are deterministic (templates.ts).
const TextSchema = z.object({
  why: z.string(),
  steps: z.array(z.string()),
});

const OutputSchema = z.object({
  summary: z.object({ en: z.string(), es: z.string() }),
  items: z.array(
    z.object({
      ruleId: z.string(),
      en: TextSchema,
      es: TextSchema,
    }),
  ),
});

export interface ExplainResult {
  explanations: Map<RuleId, Explanation>;
  summary: { en: string; es: string };
  source: "ai" | "template";
}

const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s);

function cleanText(title: string, t: z.infer<typeof TextSchema>) {
  return {
    title,
    why: clip(t.why, 400),
    steps: t.steps.slice(0, 4).map((s) => clip(s, 200)),
  };
}

function templates(findings: Finding[], score: number): ExplainResult {
  return {
    explanations: new Map(findings.map((f) => [f.ruleId, templateExplanation(f)])),
    summary: templateSummary(findings, score),
    source: "template",
  };
}

/**
 * Ask Claude to explain the findings. Never throws: on any problem
 * (no key, network error, refusal, bad output) it falls back to templates.
 *
 * PRIVACY: the request is built only by buildUserMessage() in request.ts,
 * which is covered by tests proving no emails, names or file names are sent.
 */
export async function explainFindings(findings: Finding[], score: number): Promise<ExplainResult> {
  if (findings.length === 0 || !process.env.ANTHROPIC_API_KEY) {
    return templates(findings, score);
  }

  try {
    const client = new Anthropic({ timeout: 60_000, maxRetries: 2 });
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(OutputSchema) },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(findings, score) }],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      console.warn("[explain] AI gave no usable output, using templates. stop_reason:", response.stop_reason);
      return templates(findings, score);
    }

    const out = response.parsed_output;
    const byRule = new Map(out.items.map((i) => [i.ruleId, i]));
    const explanations = new Map<RuleId, Explanation>();
    let usedAi = false;
    for (const f of findings) {
      const item = byRule.get(f.ruleId);
      if (item) {
        explanations.set(f.ruleId, { en: cleanText(titleFor(f, "en"), item.en), es: cleanText(titleFor(f, "es"), item.es) });
        usedAi = true;
      } else {
        explanations.set(f.ruleId, templateExplanation(f)); // AI skipped one: fill the gap
      }
    }
    return {
      explanations,
      summary: { en: clip(out.summary.en, 400), es: clip(out.summary.es, 400) },
      source: usedAi ? "ai" : "template",
    };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("[explain] Invalid ANTHROPIC_API_KEY, using templates.");
    } else if (error instanceof Anthropic.RateLimitError) {
      console.warn("[explain] Rate limited, using templates.");
    } else if (error instanceof Anthropic.APIError) {
      console.error(`[explain] API error ${error.status}, using templates.`);
    } else {
      console.error("[explain] Unexpected error, using templates.", error);
    }
    return templates(findings, score);
  }
}
