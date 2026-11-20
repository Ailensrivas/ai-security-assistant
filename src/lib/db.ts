import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Decision, Explanation, Finding, RuleId, StoredFinding, StoredScan } from "./types";

/**
 * SQLite through Node's built-in driver (no native packages to compile).
 * We store RESULTS only (e.g. "3 users without MFA"), never email or file contents.
 *
 * WHERE THE STATE OF A FINDING IS DECIDED
 * - "open" / "pending" / "accepted" are the owner's decisions (setDecision).
 * - A new check copies "pending" and "accepted" forward for rules it still detects
 *   (saveScan), so a decision is not lost just because the owner re-ran the check.
 * - "Fixed" is never stored: it is computed by comparing the last two checks
 *   (latestScan -> resolved). Only a new check can say something is fixed.
 */

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");

let db: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (db) return db;
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      source TEXT NOT NULL,
      domain TEXT NOT NULL,
      organization_name TEXT NOT NULL,
      score INTEGER NOT NULL,
      grade TEXT NOT NULL,
      summary_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS findings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
      priority INTEGER NOT NULL,
      rule_id TEXT NOT NULL,
      severity TEXT NOT NULL,
      count INTEGER NOT NULL,
      affected_json TEXT NOT NULL,
      fix_url TEXT NOT NULL,
      explanation_json TEXT NOT NULL,
      explanation_source TEXT NOT NULL,
      decision TEXT NOT NULL DEFAULT 'open',
      decided_at TEXT
    );
  `);
  migrate(db);
  return db;
}

/** Small, idempotent migrations for databases created by earlier versions. */
function migrate(d: DatabaseSync) {
  const colsOf = (t: string) => (d.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name);
  if (!colsOf("findings").includes("details_json")) {
    d.exec("ALTER TABLE findings ADD COLUMN details_json TEXT NOT NULL DEFAULT '{}'");
  }
  // v3: one demo per visitor. Older rows belong to no visitor.
  if (!colsOf("scans").includes("session_id")) {
    d.exec("ALTER TABLE scans ADD COLUMN session_id TEXT NOT NULL DEFAULT ''");
  }
  d.exec(`
    CREATE INDEX IF NOT EXISTS scans_session ON scans(session_id, id);
    CREATE TABLE IF NOT EXISTS ai_cache (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  // Old decision names (v1) -> new ones.
  d.exec("UPDATE findings SET decision = 'pending' WHERE decision = 'approved'");
  d.exec("UPDATE findings SET decision = 'accepted' WHERE decision = 'dismissed'");
}

export interface NewScan {
  sessionId: string;
  source: "demo" | "google";
  domain: string;
  organizationName: string;
  score: number;
  grade: string;
  summary: { en: string; es: string };
  findings: { finding: Finding; explanation: Explanation; source: "ai" | "template" }[];
}

export function saveScan(scan: NewScan): number {
  const d = getDb();
  // Decisions from the previous check, by rule, to carry forward.
  const previous = latestScan(scan.sessionId);
  const carried = new Map<RuleId, { decision: Decision; decidedAt: string | null }>();
  for (const f of previous?.findings ?? []) {
    if (f.decision !== "open") carried.set(f.ruleId, { decision: f.decision, decidedAt: f.decidedAt });
  }

  d.exec("BEGIN");
  try {
    const res = d
      .prepare(
        "INSERT INTO scans (session_id, created_at, source, domain, organization_name, score, grade, summary_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(scan.sessionId, new Date().toISOString(), scan.source, scan.domain, scan.organizationName, scan.score, scan.grade, JSON.stringify(scan.summary));
    const scanId = Number(res.lastInsertRowid);
    const insert = d.prepare(
      `INSERT INTO findings (scan_id, priority, rule_id, severity, count, affected_json, fix_url, details_json, explanation_json, explanation_source, decision, decided_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    scan.findings.forEach(({ finding: f, explanation, source }, i) => {
      const keep = carried.get(f.ruleId);
      insert.run(
        scanId, i + 1, f.ruleId, f.severity, f.count, JSON.stringify(f.affected), f.fixUrl,
        JSON.stringify(f.details), JSON.stringify(explanation), source,
        keep?.decision ?? "open", keep?.decidedAt ?? null,
      );
    });
    d.exec("COMMIT");
    return scanId;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}

type Row = Record<string, string | number | null>;

function toScan(r: Row): StoredScan {
  return {
    id: Number(r.id),
    createdAt: String(r.created_at),
    source: r.source as StoredScan["source"],
    domain: String(r.domain),
    organizationName: String(r.organization_name),
    score: Number(r.score),
    grade: String(r.grade),
    summary: JSON.parse(String(r.summary_json)),
  };
}

function toFinding(r: Row): StoredFinding {
  return {
    id: Number(r.id),
    scanId: Number(r.scan_id),
    priority: Number(r.priority),
    ruleId: r.rule_id as StoredFinding["ruleId"],
    severity: r.severity as StoredFinding["severity"],
    count: Number(r.count),
    affected: JSON.parse(String(r.affected_json)),
    fixUrl: String(r.fix_url),
    details: JSON.parse(String(r.details_json ?? "{}")),
    explanation: JSON.parse(String(r.explanation_json)),
    explanationSource: r.explanation_source as StoredFinding["explanationSource"],
    decision: r.decision as Decision,
    decidedAt: r.decided_at === null ? null : String(r.decided_at),
  };
}

function findingsOf(scanId: number): StoredFinding[] {
  return (getDb().prepare("SELECT * FROM findings WHERE scan_id = ? ORDER BY priority").all(scanId) as Row[]).map(toFinding);
}

export interface Dashboard {
  scan: StoredScan;
  findings: StoredFinding[];
  /** Risks the previous check had and this one no longer detects. */
  resolved: StoredFinding[];
  previousScan: StoredScan | null;
}

export function latestScan(sessionId: string): Dashboard | null {
  const rows = getDb().prepare("SELECT * FROM scans WHERE session_id = ? ORDER BY id DESC LIMIT 2").all(sessionId) as Row[];
  if (rows.length === 0) return null;
  const scan = toScan(rows[0]);
  const findings = findingsOf(scan.id);
  const previousScan = rows[1] ? toScan(rows[1]) : null;
  const stillThere = new Set(findings.map((f) => f.ruleId));
  const resolved = previousScan ? findingsOf(previousScan.id).filter((f) => !stillThere.has(f.ruleId)) : [];
  return { scan, findings, resolved, previousScan };
}

export function scanHistory(sessionId: string, limit = 10): StoredScan[] {
  return (getDb().prepare("SELECT * FROM scans WHERE session_id = ? ORDER BY id DESC LIMIT ?").all(sessionId, limit) as Row[]).map(toScan);
}

/**
 * Demo only: which risks the next simulated check should treat as fixed.
 *  - marked "pending verification" on the latest check, plus
 *  - already fixed earlier: seen in an older check but gone from the latest one.
 * Fixes add up, so a risk fixed two checks ago does not come back.
 */
export function simulatedFixRuleIds(sessionId: string): Set<RuleId> {
  const latest = latestScan(sessionId);
  if (!latest) return new Set();
  const everSeen = (
    getDb()
      .prepare("SELECT DISTINCT f.rule_id FROM findings f JOIN scans s ON s.id = f.scan_id WHERE s.session_id = ?")
      .all(sessionId) as Row[]
  ).map((r) => r.rule_id as RuleId);
  const onLatest = new Set(latest.findings.map((f) => f.ruleId));
  const fixes = new Set(everSeen.filter((id) => !onLatest.has(id)));
  for (const f of latest.findings) if (f.decision === "pending") fixes.add(f.ruleId);
  return fixes;
}

/**
 * Record a decision. Only works on a finding that belongs to this session, so a
 * visitor can't change someone else's results by guessing an id.
 * Returns false if the finding does not exist for this session.
 */
export function setDecision(sessionId: string, findingId: number, decision: Decision): boolean {
  const decidedAt = decision === "open" ? null : new Date().toISOString();
  const res = getDb()
    .prepare("UPDATE findings SET decision = ?, decided_at = ? WHERE id = ? AND scan_id IN (SELECT id FROM scans WHERE session_id = ?)")
    .run(decision, decidedAt, findingId, sessionId);
  return Number(res.changes) > 0;
}

/** Demo only: forget this visitor's checks so their demo starts over. */
export function resetScans(sessionId: string): void {
  getDb().prepare("DELETE FROM scans WHERE session_id = ?").run(sessionId); // findings cascade
}

/** How many checks this session ran in the last `minutes` (simple rate limit). */
export function recentScanCount(sessionId: string, minutes: number): number {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM scans WHERE session_id = ? AND created_at >= ?").get(sessionId, since) as Row;
  return Number(row.n);
}

/** Demo housekeeping: delete visitor demos older than `days`. The owner's data is never touched. */
export function purgeOldDemoScans(days: number): void {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();
  getDb().prepare("DELETE FROM scans WHERE session_id != 'owner' AND created_at < ?").run(cutoff);
}

/* AI explanation cache. Keys are hashes of the minimized request, so the cache
   never contains anything identifying. The demo always produces the same few
   requests, so after the first visitor the AI is not called again. */
export function getCached<T>(key: string): T | null {
  const row = getDb().prepare("SELECT value_json FROM ai_cache WHERE key = ?").get(key) as Row | undefined;
  return row ? (JSON.parse(String(row.value_json)) as T) : null;
}

export function setCached(key: string, value: unknown): void {
  getDb()
    .prepare("INSERT OR REPLACE INTO ai_cache (key, value_json, created_at) VALUES (?, ?, ?)")
    .run(key, JSON.stringify(value), new Date().toISOString());
}
