// Shared types for the whole app.

export type Severity = "critical" | "high" | "medium" | "low";

export type Lang = "en" | "es";

/** What a collector returns: a read-only picture of one Workspace tenant. */
export interface WorkspaceSnapshot {
  domain: string;
  organizationName: string;
  collectedAt: string; // ISO date
  users: WorkspaceUser[];
  forwarding: ForwardingRule[];
  publicFiles: PublicFile[];
  thirdPartyApps: ThirdPartyApp[];
}

export interface WorkspaceUser {
  email: string;
  name: string;
  isSuperAdmin: boolean;
  isDelegatedAdmin: boolean;
  mfaEnrolled: boolean;
  suspended: boolean;
  lastLoginAt: string | null; // ISO date, null = never logged in
}

export interface ForwardingRule {
  ownerEmail: string;
  forwardTo: string;
  kind: "auto-forwarding" | "filter";
}

export interface PublicFile {
  ownerEmail: string;
  fileName: string; // untrusted text from the tenant
  visibility: "anyoneWithLink" | "anyoneCanFind";
}

export interface ThirdPartyApp {
  userEmail: string;
  appName: string; // untrusted text from the tenant
  scopes: string[];
}

export type RuleId =
  | "MFA_MISSING_ADMIN"
  | "MFA_MISSING_USER"
  | "EXTERNAL_FORWARDING"
  | "TOO_MANY_ADMINS"
  | "PUBLIC_FILES"
  | "INACTIVE_ACCOUNTS"
  | "RISKY_THIRD_PARTY_APPS";

/** A risk detected by a deterministic rule. */
export interface Finding {
  ruleId: RuleId;
  severity: Severity;
  /** How many users/files/apps are affected. */
  count: number;
  /** Short identifiers shown only in our own UI (never sent to the AI). */
  affected: string[];
  /** Where the owner fixes it in the Google Admin console. */
  fixUrl: string;
  /** Exact facts the rule observed, used to write precise titles. */
  details: FindingDetails;
}

export type AccessKind = "gmail" | "drive" | "admin";

export interface FindingDetails {
  /** INACTIVE_ACCOUNTS: longest time without login, in days (null if every one never logged in). */
  maxInactiveDays?: number | null;
  /** INACTIVE_ACCOUNTS: how many accounts never logged in. */
  neverLoggedIn?: number;
  /** RISKY_THIRD_PARTY_APPS: which kinds of broad access were detected. */
  accessKinds?: AccessKind[];
  /** RISKY_THIRD_PARTY_APPS: app name when only one app is affected (untrusted, UI only). */
  appName?: string;
}

/** Plain-language explanation of one finding, in one language. */
export interface ExplanationText {
  title: string;
  why: string;
  steps: string[];
}

export interface Explanation {
  en: ExplanationText;
  es: ExplanationText;
}

/**
 * open     = nobody has acted yet
 * pending  = the owner says they applied the fix; a new check must confirm it
 * accepted = the owner accepts the risk on purpose (stays visible as an exception)
 * "Fixed" is not a decision: it is only shown when a new check no longer detects the risk.
 */
export type Decision = "open" | "pending" | "accepted";

export interface StoredFinding extends Finding {
  id: number;
  scanId: number;
  explanation: Explanation;
  explanationSource: "ai" | "template";
  priority: number;
  decision: Decision;
  decidedAt: string | null;
}

export interface StoredScan {
  id: number;
  createdAt: string;
  source: "demo" | "google";
  domain: string;
  organizationName: string;
  score: number;
  grade: string;
  summary: { en: string; es: string };
}
