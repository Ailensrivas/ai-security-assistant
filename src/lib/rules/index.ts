import type { AccessKind, Finding, FindingDetails, Severity, WorkspaceSnapshot, WorkspaceUser } from "../types";

/**
 * Deterministic rules. These decide WHAT is a risk and HOW serious it is.
 * The AI never changes these results; it only explains them.
 */

const ADMIN = "https://admin.google.com/ac";
export const INACTIVE_DAYS = 90;
export const MAX_SUPER_ADMINS = 2;

/** Scopes that give an app broad access to mail, files or the admin console. */
const RISKY_SCOPE_PATTERNS = [
  /^https:\/\/mail\.google\.com\/?$/,
  /\/auth\/gmail\.(modify|compose|send|insert)$/,
  /\/auth\/gmail\.readonly$/,
  /\/auth\/drive$/,
  /\/auth\/admin\./,
];

const activeUsers = (s: WorkspaceSnapshot) => s.users.filter((u) => !u.suspended);

const isAdmin = (u: WorkspaceUser) => u.isSuperAdmin || u.isDelegatedAdmin;

/** Domain part of an email, lowercase. */
export function domainOf(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).toLowerCase();
}

/** True if `email` is outside the organization's domain (subdomains count as inside). */
export function isExternal(email: string, orgDomain: string): boolean {
  const d = domainOf(email);
  const org = orgDomain.toLowerCase();
  return d !== org && !d.endsWith("." + org);
}

type Rule = (s: WorkspaceSnapshot, now: Date) => Finding | null;

function finding(
  ruleId: Finding["ruleId"],
  severity: Severity,
  affected: string[],
  fixUrl: string,
  details: FindingDetails = {},
): Finding | null {
  if (affected.length === 0) return null;
  return { ruleId, severity, count: affected.length, affected, fixUrl, details };
}

const mfaMissingAdmin: Rule = (s) =>
  finding(
    "MFA_MISSING_ADMIN",
    "critical",
    activeUsers(s).filter((u) => isAdmin(u) && !u.mfaEnrolled).map((u) => u.email),
    `${ADMIN}/security/2sv`,
  );

const mfaMissingUser: Rule = (s) =>
  finding(
    "MFA_MISSING_USER",
    "high",
    activeUsers(s).filter((u) => !isAdmin(u) && !u.mfaEnrolled).map((u) => u.email),
    `${ADMIN}/security/2sv`,
  );

const externalForwarding: Rule = (s) => {
  const active = new Set(activeUsers(s).map((u) => u.email.toLowerCase()));
  const affected = s.forwarding
    .filter((f) => active.has(f.ownerEmail.toLowerCase()) && isExternal(f.forwardTo, s.domain))
    .map((f) => `${f.ownerEmail} → ${f.forwardTo}`);
  return finding("EXTERNAL_FORWARDING", "critical", affected, `${ADMIN}/apps/gmail/usersettings`);
};

const tooManyAdmins: Rule = (s) => {
  const users = activeUsers(s);
  const supers = users.filter((u) => u.isSuperAdmin);
  if (supers.length <= MAX_SUPER_ADMINS) return null;
  // In a tiny company, 3 admins out of 5 people is much worse than 3 out of 50.
  const severity: Severity = supers.length / users.length > 0.3 ? "high" : "medium";
  return finding("TOO_MANY_ADMINS", severity, supers.map((u) => u.email), `${ADMIN}/roles`);
};

const publicFiles: Rule = (s) =>
  finding(
    "PUBLIC_FILES",
    "high",
    s.publicFiles.map((f) => f.fileName),
    `${ADMIN}/appsettings/55656082996`, // Drive and Docs sharing settings
  );

const DAY = 24 * 60 * 60 * 1000;

const inactiveAccounts: Rule = (s, now) => {
  const limit = now.getTime() - INACTIVE_DAYS * DAY;
  const inactive = activeUsers(s).filter(
    (u) => u.lastLoginAt === null || new Date(u.lastLoginAt).getTime() < limit,
  );
  const days = inactive
    .filter((u) => u.lastLoginAt !== null)
    .map((u) => Math.floor((now.getTime() - new Date(u.lastLoginAt!).getTime()) / DAY));
  return finding("INACTIVE_ACCOUNTS", "medium", inactive.map((u) => u.email), `${ADMIN}/users`, {
    maxInactiveDays: days.length ? Math.max(...days) : null,
    neverLoggedIn: inactive.filter((u) => u.lastLoginAt === null).length,
  });
};

export function isRiskyScope(scope: string): boolean {
  return RISKY_SCOPE_PATTERNS.some((p) => p.test(scope));
}

/** Which kind of broad access a risky scope gives (null if the scope is not risky). */
export function accessKindOf(scope: string): AccessKind | null {
  if (!isRiskyScope(scope)) return null;
  if (/\/auth\/admin\./.test(scope)) return "admin";
  if (/\/auth\/drive$/.test(scope)) return "drive";
  return "gmail";
}

const KIND_ORDER: AccessKind[] = ["gmail", "drive", "admin"];

const riskyApps: Rule = (s) => {
  const risky = s.thirdPartyApps.filter((a) => a.scopes.some(isRiskyScope));
  const kinds = new Set(risky.flatMap((a) => a.scopes.map(accessKindOf).filter((k): k is AccessKind => k !== null)));
  const appNames = new Set(risky.map((a) => a.appName));
  return finding(
    "RISKY_THIRD_PARTY_APPS",
    "high",
    risky.map((a) => `${a.appName} (${a.userEmail})`),
    `${ADMIN}/owl/list?tab=configuredApps`,
    {
      accessKinds: KIND_ORDER.filter((k) => kinds.has(k)),
      appName: appNames.size === 1 ? [...appNames][0].slice(0, 60) : undefined,
    },
  );
};

const RULES: Rule[] = [
  mfaMissingAdmin,
  externalForwarding,
  mfaMissingUser,
  publicFiles,
  riskyApps,
  tooManyAdmins,
  inactiveAccounts,
];

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** Run every rule. Result is sorted from most to least severe. */
export function evaluate(snapshot: WorkspaceSnapshot, now: Date = new Date()): Finding[] {
  return RULES.map((rule) => rule(snapshot, now))
    .filter((f): f is Finding => f !== null)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.count - a.count);
}

export const SEVERITY_PENALTY: Record<Severity, number> = { critical: 20, high: 10, medium: 5, low: 2 };

/** 100 minus a penalty per finding, never below 0. */
export function scoreFindings(findings: Finding[]): number {
  const penalty = findings.reduce((sum, f) => sum + SEVERITY_PENALTY[f.severity], 0);
  return Math.max(0, 100 - penalty);
}

export function gradeFor(score: number): string {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}
