import { decideAction } from "../actions";
import { affectedLabel } from "@/lib/ai/templates";
import { DECISION_LABEL, SEVERITY_LABEL, UI, formatDate } from "@/lib/i18n";
import type { Decision, Lang, StoredFinding } from "@/lib/types";
import { SubmitButton } from "./SubmitButton";

export const SEVERITY_STYLE = {
  critical: "bg-critical/10 text-critical border-critical/30",
  high: "bg-high/10 text-high border-high/30",
  medium: "bg-medium/10 text-medium border-medium/30",
  low: "bg-low/10 text-low border-low/30",
} as const;

const DECISION_STYLE: Record<Decision, string> = {
  open: "",
  pending: "bg-brand/10 text-brand border-brand/30",
  accepted: "bg-background text-muted border-border",
};

const MAX_SHOWN = 5;

/**
 * One risk. Collapsed by default (title + severity + "View steps") so the list
 * stays short on a phone; the priority risk opens expanded.
 * `stillDetected`: the owner marked it pending, but a newer check still finds it.
 */
export function FindingCard({
  finding,
  lang,
  open,
  stillDetected,
}: {
  finding: StoredFinding;
  lang: Lang;
  open: boolean;
  stillDetected: boolean;
}) {
  const t = UI[lang];
  const text = finding.explanation[lang];

  return (
    <details
      id={`finding-${finding.id}`}
      open={open}
      className="group scroll-mt-6 rounded-xl border border-border bg-card shadow-sm"
    >
      <summary className="flex cursor-pointer list-none flex-col gap-2 p-5 [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${SEVERITY_STYLE[finding.severity]}`}>
            {SEVERITY_LABEL[lang][finding.severity]}
          </span>
          {finding.decision !== "open" && (
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${DECISION_STYLE[finding.decision]}`}>
              {DECISION_LABEL[lang][finding.decision]}
            </span>
          )}
        </div>
        {/* React escapes all text, so names coming from the tenant cannot inject HTML. */}
        <h3 className="text-base font-semibold leading-snug sm:text-lg">{text.title}</h3>
        <span className="text-sm font-medium text-brand">
          <span className="group-open:hidden">{t.viewSteps} ▾</span>
          <span className="hidden group-open:inline">{t.hideSteps} ▴</span>
        </span>
      </summary>

      <div className="border-t border-border px-5 pb-5 pt-4">
        {stillDetected && (
          <p className="mb-3 rounded-lg bg-high/10 px-3 py-2 text-sm text-high">{t.stillDetected}</p>
        )}
        <p className="text-sm leading-relaxed text-muted">{text.why}</p>

        <h4 className="mt-4 text-sm font-semibold">{t.howToFix}</h4>
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
          {text.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>

        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-medium text-muted">{affectedLabel(finding.ruleId, finding.count, lang)}</summary>
          <ul className="mt-2 space-y-0.5 font-mono text-xs break-all">
            {finding.affected.slice(0, MAX_SHOWN).map((a, i) => (
              <li key={i}>{a}</li>
            ))}
            {finding.count > MAX_SHOWN && <li className="text-muted">+{finding.count - MAX_SHOWN}</li>}
          </ul>
        </details>

        <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4">
          <a
            href={finding.fixUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-background"
          >
            {t.openAdmin} ↗
          </a>

          {finding.decision === "open" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <DecisionForm id={finding.id} decision="pending" label={t.markPending} help={t.markPendingHelp} variant="primary" />
              <DecisionForm id={finding.id} decision="accepted" label={t.acceptRisk} help={t.acceptRiskHelp} variant="secondary" />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
              <span>
                {DECISION_LABEL[lang][finding.decision]}
                {finding.decidedAt ? ` · ${formatDate(finding.decidedAt, lang)}` : ""}
              </span>
              <DecisionForm id={finding.id} decision="open" label={t.undo} variant="ghost" />
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

function DecisionForm({
  id,
  decision,
  label,
  help,
  variant,
}: {
  id: number;
  decision: Decision;
  label: string;
  help?: string;
  variant: "primary" | "secondary" | "ghost";
}) {
  return (
    <form action={decideAction} className="flex flex-col gap-1">
      <input type="hidden" name="findingId" value={id} />
      <input type="hidden" name="decision" value={decision} />
      <SubmitButton label={label} variant={variant} />
      {help && <p className="text-xs leading-snug text-muted">{help}</p>}
    </form>
  );
}
