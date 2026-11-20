# Architecture — AI Security Assistant (Stage 1)

A read-only security posture checker for small businesses on Google Workspace.
It finds the most common configuration risks, scores them, and uses an AI model
to explain each one in plain English and Spanish. **Nothing is changed without a
human approving it, and in Stage 1 the app never changes anything at all.**

## Goals and non-goals

| In scope (Stage 1) | Out of scope (later stages) |
|---|---|
| Read Workspace settings (users, admins, MFA, forwarding, public files, third-party apps) | Real-time alerts (Alert Center API) — Stage 2 |
| Deterministic rules → findings → 0–100 score | Automatic remediation — Stage 3 |
| AI explanations in EN/ES | Endpoint protection (Wazuh/osquery) — Stage 4 |
| Human approve/dismiss of each recommendation | Multi-tenant SaaS, billing |
| Demo mode with planted problems (no Google account needed) | Microsoft 365 |

## Data flow

```
 ┌──────────────┐   1. collect (read-only)   ┌─────────────────────────┐
 │  Collector   │ ─────────────────────────▶ │  WorkspaceSnapshot       │
 │  demo|google │                            │  (users, files, apps…)   │
 └──────────────┘                            └────────────┬────────────┘
                                                          │ 2. evaluate
                                                          ▼
                                             ┌─────────────────────────┐
                                             │  Rules engine            │  deterministic,
                                             │  → Finding[] + score     │  unit-tested
                                             └────────────┬────────────┘
                                                          │ 3. explain (minimized data)
                                                          ▼
                                             ┌─────────────────────────┐
                                             │  AI explainer            │  Claude, structured JSON
                                             │  (fallback: templates)   │  cannot change severity/score
                                             └────────────┬────────────┘
                                                          │ 4. store
                                                          ▼
                                             ┌─────────────────────────┐
                                             │  SQLite (node:sqlite)    │  results only,
                                             │  scans, findings         │  never email/file contents
                                             └────────────┬────────────┘
                                                          │ 5. show + decide
                                                          ▼
                                             ┌─────────────────────────┐
                                             │  Dashboard (Next.js)     │  approve / dismiss
                                             │  EN / ES                 │  = recorded decision only
                                             └─────────────────────────┘
```

## Modules

| Path | Responsibility |
|---|---|
| `src/lib/types.ts` | Shared types: `WorkspaceSnapshot`, `Finding`, `Severity`, `Explanation` |
| `src/lib/collectors/demo.ts` | Fake company "Sunrise Insurance Agency" with planted problems |
| `src/lib/collectors/google.ts` | Google Admin SDK / Gmail / Drive reads with **read-only** scopes |
| `src/lib/rules/` | One rule per risk + `evaluate()` + `scoreFindings()` |
| `src/lib/ai/explain.ts` | Claude call with structured output; template fallback |
| `src/lib/ai/templates.ts` | Hand-written EN/ES explanations (used offline or if the AI fails) |
| `src/lib/db.ts` | SQLite schema and queries |
| `src/lib/scan.ts` | Orchestrates collect → evaluate → explain → store |
| `src/lib/auth.ts` | Basic-auth check, used by `proxy.ts` and by every server action |
| `src/app/` | Pages and server actions |

## Security decisions (and why)

1. **Read-only scopes only.** The Google collector requests `*.readonly` scopes wherever
   Google offers one. Exceptions are documented next to the scope in `google.ts`.
2. **Rules decide, AI explains.** Severity and score come from deterministic code that is
   unit-tested. The model only writes explanations; its output cannot change a finding.
3. **Data minimization to the AI.** The model receives rule IDs, severities, counts, the kind of
   access and days without sign-in — no email addresses, names, file or app names. The request is
   built only in `src/lib/ai/request.ts`, and `request.test.ts` proves nothing identifying (including
   the trap file name) is sent. Titles are deterministic, written by the rules, not by the AI.
4. **Untrusted data stays data.** Anything that comes from the customer's tenant is treated
   as data, never as instructions, and is escaped when rendered.
5. **Store results, not content.** The database stores findings (e.g. "3 users without MFA"),
   never mail bodies or file contents.
6. **Human in the loop.** Decisions are `open`, `pending` (owner says it is fixed) and `accepted`
   (risk accepted as a visible exception). **Fixed** is never stored: it is computed by comparing the
   last two checks (`src/lib/db.ts`). Stage 1 links to the Google Admin page where the owner fixes it.
   In demo mode, pending fixes are simulated so the full loop can be shown.
7. **Secrets in environment variables.** `.env.local` is git-ignored; `.env.example`
   documents every variable without values.
8. **Access control on every request.** `proxy.ts` gates every route, and each server
   action re-checks authorization (defense in depth).
9. **Graceful degradation.** No API key or an AI error → template explanations. The scan
   never fails because of the AI.

## Score

Start at 100 and subtract per finding: critical 20, high 10, medium 5, low 2 (minimum 0).
Grades: 90–100 A, 75–89 B, 60–74 C, 40–59 D, below 40 F.

## Rules (Stage 1)

| ID | Detects | Severity |
|---|---|---|
| `MFA_MISSING_ADMIN` | Admin accounts without 2-Step Verification | critical |
| `MFA_MISSING_USER` | Regular users without 2-Step Verification | high |
| `EXTERNAL_FORWARDING` | Auto-forwarding or filters forwarding mail outside the domain | critical |
| `TOO_MANY_ADMINS` | More than 2 super admins | medium (high if >30% of users) |
| `PUBLIC_FILES` | Drive files shared "anyone with the link" / public | high |
| `INACTIVE_ACCOUNTS` | Active accounts with no login in 90+ days (or never) | medium |
| `RISKY_THIRD_PARTY_APPS` | Third-party apps with full mail/Drive/admin access | high |

## Running modes

- `DATA_SOURCE=demo` (default): no Google account needed. Good for the portfolio video.
- `DATA_SOURCE=google`: real Workspace through a service account with domain-wide
  delegation (see README → "Connect Google Workspace").

## Next stages

- **Stage 2:** Alert Center API polling → near-real-time alerts (suspicious login, phishing).
- **Stage 3:** approved actions executed via API (sign out user, force password reset).
- **Stage 4:** endpoint signals from Wazuh/osquery.
