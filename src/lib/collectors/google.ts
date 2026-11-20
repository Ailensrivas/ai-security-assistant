import "server-only";
import { admin } from "@googleapis/admin";
import { drive } from "@googleapis/drive";
import { gmail } from "@googleapis/gmail";
import { JWT } from "google-auth-library";
import type { ForwardingRule, PublicFile, ThirdPartyApp, WorkspaceSnapshot, WorkspaceUser } from "../types";

/**
 * Reads a real Google Workspace tenant. READ-ONLY: this file only calls
 * list/get methods. Nothing is created, changed or deleted.
 *
 * Auth: a Google Cloud service account with domain-wide delegation, acting as
 * an admin (for directory data) and as each user (for their Gmail settings and
 * Drive metadata). Setup steps are in README.md.
 *
 * Scopes and why (least privilege):
 *  - admin.directory.user.readonly  -> list users, admin flags, MFA, last login
 *  - admin.directory.user.security  -> list third-party app tokens. Google offers
 *                                      no read-only variant; we only call tokens.list.
 *  - gmail.settings.basic           -> read forwarding settings and filters. Chosen
 *                                      over gmail.readonly because that one exposes
 *                                      mail CONTENT. We only call get/list.
 *  - drive.metadata.readonly        -> find files shared publicly (names only, no content)
 */
export const SCOPES = {
  directory: [
    "https://www.googleapis.com/auth/admin.directory.user.readonly",
    "https://www.googleapis.com/auth/admin.directory.user.security",
  ],
  perUser: [
    "https://www.googleapis.com/auth/gmail.settings.basic",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
  ],
};

const MAX_USERS = 300; // Stage 1 is for small businesses
const CONCURRENCY = 5;

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

function readConfig() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const adminEmail = process.env.GOOGLE_ADMIN_EMAIL;
  const domain = process.env.GOOGLE_DOMAIN;
  if (!raw || !adminEmail || !domain) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_ADMIN_EMAIL or GOOGLE_DOMAIN. See .env.example.");
  }
  const key = JSON.parse(raw) as ServiceAccountKey;
  return { key, adminEmail, domain };
}

function jwtFor(key: ServiceAccountKey, subject: string, scopes: string[]) {
  return new JWT({ email: key.client_email, key: key.private_key, scopes, subject });
}

/** Run `fn` over `items` with limited parallelism. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function googleSnapshot(): Promise<WorkspaceSnapshot> {
  const { key, adminEmail, domain } = readConfig();
  const directory = admin({ version: "directory_v1", auth: jwtFor(key, adminEmail, SCOPES.directory) });

  // 1. Users
  const users: WorkspaceUser[] = [];
  let pageToken: string | undefined;
  do {
    const res = await directory.users.list({ customer: "my_customer", maxResults: 100, pageToken, projection: "basic" });
    for (const u of res.data.users ?? []) {
      if (!u.primaryEmail) continue;
      const last = u.lastLoginTime && !u.lastLoginTime.startsWith("1970") ? u.lastLoginTime : null;
      users.push({
        email: u.primaryEmail,
        name: u.name?.fullName ?? u.primaryEmail,
        isSuperAdmin: Boolean(u.isAdmin),
        isDelegatedAdmin: Boolean(u.isDelegatedAdmin),
        mfaEnrolled: Boolean(u.isEnrolledIn2Sv),
        suspended: Boolean(u.suspended),
        lastLoginAt: last,
      });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken && users.length < MAX_USERS);

  const active = users.filter((u) => !u.suspended).slice(0, MAX_USERS);

  // 2. Per-user checks. A failure for one user (e.g. no Gmail license) must not stop the scan.
  const perUser = await mapLimit(active, CONCURRENCY, async (u) => {
    const forwarding: ForwardingRule[] = [];
    const publicFiles: PublicFile[] = [];
    const thirdPartyApps: ThirdPartyApp[] = [];
    const userAuth = jwtFor(key, u.email, SCOPES.perUser);

    try {
      const g = gmail({ version: "v1", auth: userAuth });
      const auto = await g.users.settings.getAutoForwarding({ userId: "me" });
      if (auto.data.enabled && auto.data.emailAddress) {
        forwarding.push({ ownerEmail: u.email, forwardTo: auto.data.emailAddress, kind: "auto-forwarding" });
      }
      const filters = await g.users.settings.filters.list({ userId: "me" });
      for (const f of filters.data.filter ?? []) {
        if (f.action?.forward) forwarding.push({ ownerEmail: u.email, forwardTo: f.action.forward, kind: "filter" });
      }
    } catch (e) {
      console.warn(`[google] Gmail settings skipped for one user: ${(e as Error).message}`);
    }

    try {
      const d = drive({ version: "v3", auth: userAuth });
      const res = await d.files.list({
        q: "'me' in owners and trashed = false and (visibility = 'anyoneWithLink' or visibility = 'anyoneCanFind')",
        fields: "files(name)",
        pageSize: 100,
      });
      for (const f of res.data.files ?? []) {
        publicFiles.push({ ownerEmail: u.email, fileName: f.name ?? "(no name)", visibility: "anyoneWithLink" });
      }
    } catch (e) {
      console.warn(`[google] Drive check skipped for one user: ${(e as Error).message}`);
    }

    try {
      const tokens = await directory.tokens.list({ userKey: u.email });
      for (const t of tokens.data.items ?? []) {
        thirdPartyApps.push({ userEmail: u.email, appName: t.displayText ?? t.clientId ?? "(unknown app)", scopes: t.scopes ?? [] });
      }
    } catch (e) {
      console.warn(`[google] App tokens skipped for one user: ${(e as Error).message}`);
    }

    return { forwarding, publicFiles, thirdPartyApps };
  });

  return {
    domain,
    organizationName: domain,
    collectedAt: new Date().toISOString(),
    users,
    forwarding: perUser.flatMap((p) => p.forwarding),
    publicFiles: perUser.flatMap((p) => p.publicFiles),
    thirdPartyApps: perUser.flatMap((p) => p.thirdPartyApps),
  };
}
