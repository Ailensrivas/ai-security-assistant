import { describe, expect, it } from "vitest";
import { demoSnapshot } from "../collectors/demo";
import type { WorkspaceSnapshot } from "../types";
import { evaluate, gradeFor, isExternal, isRiskyScope, scoreFindings } from "./index";

const NOW = new Date("2026-11-18T12:00:00Z");

function emptySnapshot(): WorkspaceSnapshot {
  return {
    domain: "acme.example",
    organizationName: "Acme",
    collectedAt: NOW.toISOString(),
    users: [
      { email: "a@acme.example", name: "A", isSuperAdmin: true, isDelegatedAdmin: false, mfaEnrolled: true, suspended: false, lastLoginAt: NOW.toISOString() },
    ],
    forwarding: [],
    publicFiles: [],
    thirdPartyApps: [],
  };
}

describe("evaluate", () => {
  it("finds nothing in a healthy tenant and scores 100", () => {
    const findings = evaluate(emptySnapshot(), NOW);
    expect(findings).toEqual([]);
    expect(scoreFindings(findings)).toBe(100);
  });

  it("detects every planted problem in the demo company", () => {
    const ids = evaluate(demoSnapshot(NOW), NOW).map((f) => f.ruleId);
    expect(ids).toEqual(
      expect.arrayContaining([
        "MFA_MISSING_ADMIN",
        "MFA_MISSING_USER",
        "EXTERNAL_FORWARDING",
        "TOO_MANY_ADMINS",
        "PUBLIC_FILES",
        "INACTIVE_ACCOUNTS",
        "RISKY_THIRD_PARTY_APPS",
      ]),
    );
  });

  it("sorts critical findings first", () => {
    const findings = evaluate(demoSnapshot(NOW), NOW);
    expect(findings[0].severity).toBe("critical");
    expect(findings.at(-1)!.severity).toBe("medium");
  });

  it("ignores suspended users", () => {
    const f = evaluate(demoSnapshot(NOW), NOW);
    const all = f.flatMap((x) => x.affected).join(" ");
    expect(all).not.toContain("old.intern");
  });

  it("does not flag internal forwarding", () => {
    const fwd = evaluate(demoSnapshot(NOW), NOW).find((f) => f.ruleId === "EXTERNAL_FORWARDING")!;
    expect(fwd.count).toBe(1);
    expect(fwd.affected[0]).toContain("reception@");
  });

  it("does not flag apps with narrow scopes", () => {
    const apps = evaluate(demoSnapshot(NOW), NOW).find((f) => f.ruleId === "RISKY_THIRD_PARTY_APPS")!;
    expect(apps.count).toBe(1);
    expect(apps.affected[0]).toContain("PDF");
  });

  it("flags a user who never logged in as inactive", () => {
    const s = emptySnapshot();
    s.users.push({ email: "new@acme.example", name: "N", isSuperAdmin: false, isDelegatedAdmin: false, mfaEnrolled: true, suspended: false, lastLoginAt: null });
    const f = evaluate(s, NOW).find((x) => x.ruleId === "INACTIVE_ACCOUNTS");
    expect(f?.affected).toEqual(["new@acme.example"]);
  });

  it("allows up to 2 super admins", () => {
    const s = emptySnapshot();
    s.users.push({ ...s.users[0], email: "b@acme.example" });
    expect(evaluate(s, NOW).find((x) => x.ruleId === "TOO_MANY_ADMINS")).toBeUndefined();
    s.users.push({ ...s.users[0], email: "c@acme.example" });
    expect(evaluate(s, NOW).find((x) => x.ruleId === "TOO_MANY_ADMINS")?.severity).toBe("high");
  });
});

describe("helpers", () => {
  it("treats subdomains as internal", () => {
    expect(isExternal("x@mail.acme.example", "acme.example")).toBe(false);
    expect(isExternal("x@acme.example.evil.com", "acme.example")).toBe(true);
    expect(isExternal("x@notacme.example", "acme.example")).toBe(true);
  });

  it("recognizes risky scopes", () => {
    expect(isRiskyScope("https://mail.google.com/")).toBe(true);
    expect(isRiskyScope("https://www.googleapis.com/auth/drive")).toBe(true);
    expect(isRiskyScope("https://www.googleapis.com/auth/drive.file")).toBe(false);
    expect(isRiskyScope("https://www.googleapis.com/auth/calendar.readonly")).toBe(false);
  });

  it("never scores below 0 and grades correctly", () => {
    const f = evaluate(demoSnapshot(NOW), NOW);
    expect(scoreFindings([...f, ...f, ...f])).toBe(0);
    expect(gradeFor(100)).toBe("A");
    expect(gradeFor(75)).toBe("B");
    expect(gradeFor(39)).toBe("F");
  });
});
