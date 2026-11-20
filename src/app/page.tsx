import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { resetDemoAction, runScanAction } from "./actions";
import { FindingCard, SEVERITY_STYLE } from "./components/FindingCard";
import { SubmitButton } from "./components/SubmitButton";
import { isPublicDemo } from "@/lib/auth";
import { latestScan, recentScanCount, scanHistory, type Dashboard } from "@/lib/db";
import { MAX_SCANS_PER_HOUR } from "@/lib/scan";
import { currentSessionId } from "@/lib/session";
import { SEVERITY_LABEL, UI, formatDate, parseLang } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

export default function Page({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <DashboardView searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function DashboardView({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const lang = parseLang((await searchParams).lang);
  await connection(); // the database is read on every request, never at build time
  const t = UI[lang];
  const sessionId = await currentSessionId();
  const data = latestScan(sessionId);
  const history = scanHistory(sessionId, 6);
  const isDemo = process.env.DATA_SOURCE !== "google";
  const rateLimited = isDemo && recentScanCount(sessionId, 60) >= MAX_SCANS_PER_HOUR;

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">🛡️ AI Security Assistant</h1>
          <p className="mt-1 text-sm text-muted">{t.tagline}</p>
        </div>
        <LangToggle lang={lang} />
      </header>

      {isDemo && (
        <p className="mt-6 rounded-lg border border-brand/20 bg-brand/5 px-4 py-2 text-sm text-brand">
          {t.demoNote}
          {isPublicDemo() && <> {t.publicDemoNote}</>}
        </p>
      )}
      {rateLimited && (
        <p className="mt-3 rounded-lg border border-high/30 bg-high/10 px-4 py-2 text-sm text-high">{t.rateLimited}</p>
      )}

      {!data ? (
        <section className="mt-6 flex flex-col items-start gap-4 rounded-xl border border-dashed border-border bg-card p-6">
          <p className="text-muted">{t.noScan}</p>
          <form action={runScanAction}>
            <SubmitButton label={t.runScan} pendingLabel={t.running} />
          </form>
        </section>
      ) : (
        <Results data={data} lang={lang} isDemo={isDemo} history={history} />
      )}
    </>
  );
}

function Results({
  data,
  lang,
  isDemo,
  history,
}: {
  data: Dashboard;
  lang: Lang;
  isDemo: boolean;
  history: ReturnType<typeof scanHistory>;
}) {
  const t = UI[lang];
  const { scan, findings, resolved } = data;
  const open = findings.filter((f) => f.decision === "open");
  const pending = findings.filter((f) => f.decision === "pending");
  const next = open[0];
  const criticalOpen = open.filter((f) => f.severity === "critical").length;
  // "Pending" carried over from an older check means the new check still sees it.
  const stillDetected = (decidedAt: string | null) => decidedAt !== null && decidedAt < scan.createdAt;

  return (
    <>
      {/* 1. NEXT ACTION: the most visible thing on the page. */}
      <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        {next ? (
          <>
            <p className="text-sm font-semibold">
              {criticalOpen > 0 ? (
                <span className="text-critical">{t.critical(criticalOpen)}</span>
              ) : (
                <span>{t.risksOpen(open.length)}</span>
              )}
              {criticalOpen > 0 && <span className="text-muted"> · {t.risksOpen(open.length)}</span>}
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">{t.startWith}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${SEVERITY_STYLE[next.severity]}`}>
                {SEVERITY_LABEL[lang][next.severity]}
              </span>
              <h2 className="text-lg font-bold leading-snug sm:text-xl">{next.explanation[lang].title}</h2>
            </div>
            <a
              href={`#finding-${next.id}`}
              className="mt-4 inline-block rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand/90"
            >
              {t.seeHow} ↓
            </a>
            {/* The AI summary was written for the first risk; hide it once the owner has moved past it. */}
            {next.id === findings[0].id && (
              <p className="mt-4 text-sm leading-relaxed text-muted">{scan.summary[lang]}</p>
            )}
          </>
        ) : (
          <p className="text-base font-semibold">{pending.length > 0 ? t.allPending(pending.length) : t.allClear}</p>
        )}
      </section>

      {/* 2. FIXED since the previous check (only a new check can say this). */}
      {resolved.length > 0 && (
        <section className="mt-6 rounded-xl border border-low/30 bg-low/5 p-5">
          <h2 className="text-sm font-semibold text-low">
            ✓ {t.fixedTitle} ({resolved.length})
          </h2>
          <ul className="mt-2 space-y-2 text-sm">
            {resolved.map((f) => (
              <li key={f.id}>
                <span className="font-medium line-through decoration-low/60">{f.explanation[lang].title}</span>
                <br />
                <span className="text-xs text-low">
                  {isDemo ? t.fixedSimulated : t.fixedConfirmed(formatDate(scan.createdAt, lang))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 3. THE LIST: priority risk open, the rest collapsed. */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            {t.risks} ({findings.length})
          </h2>
          <form action={runScanAction}>
            <SubmitButton label={t.rerun} pendingLabel={t.running} variant="secondary" />
          </form>
        </div>
        <div className="mt-4 space-y-3">
          {findings.map((f) => (
            <FindingCard
              key={f.id}
              finding={f}
              lang={lang}
              open={f.id === next?.id}
              stillDetected={f.decision === "pending" && stillDetected(f.decidedAt)}
            />
          ))}
        </div>
      </section>

      {/* 4. PROGRESS: the score, small, next to the history. */}
      <section className="mt-10 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-muted">{t.progress}</h2>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-sm text-muted">{t.score}</span>
          <span className="font-mono text-2xl font-bold tabular-nums">{scan.score}/100</span>
          <span className="font-mono text-sm text-muted">{scan.grade}</span>
        </p>
        <p className="mt-1 text-xs text-muted">
          {t.lastCheck}: {formatDate(scan.createdAt, lang)}
        </p>
        {history.length > 1 && (
          <>
            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">{t.history}</h3>
            <ul className="mt-1 divide-y divide-border text-sm">
              {history.slice(1).map((s) => (
                <li key={s.id} className="flex justify-between py-1.5">
                  <span>{formatDate(s.createdAt, lang)}</span>
                  <span className="font-mono tabular-nums">
                    {s.score}/100 · {s.grade}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        {isDemo && (
          <form action={resetDemoAction} className="mt-4">
            <SubmitButton label={t.resetDemo} variant="ghost" />
          </form>
        )}
      </section>

      <p className="mt-6 text-xs leading-relaxed text-muted">
        {findings[0]?.explanationSource === "ai" ? t.aiNote : t.templateNote} {t.humanNote}
      </p>
    </>
  );
}

function LangToggle({ lang }: { lang: Lang }) {
  const base = "rounded-md px-3 py-1 text-sm font-medium";
  return (
    <nav className="flex rounded-lg border border-border bg-card p-1" aria-label="Language">
      <Link href="/?lang=en" className={`${base} ${lang === "en" ? "bg-brand text-white" : "text-muted"}`}>
        EN
      </Link>
      <Link href="/?lang=es" className={`${base} ${lang === "es" ? "bg-brand text-white" : "text-muted"}`}>
        ES
      </Link>
    </nav>
  );
}
