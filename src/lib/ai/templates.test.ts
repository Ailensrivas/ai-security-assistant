import { describe, expect, it } from "vitest";
import { demoSnapshot } from "../collectors/demo";
import { evaluate } from "../rules";
import type { RuleId } from "../types";
import { titleFor } from "./templates";

const NOW = new Date("2026-11-18T12:00:00Z");
const byRule = (fixes: RuleId[] = []) =>
  new Map(evaluate(demoSnapshot(NOW, new Set(fixes)), NOW).map((f) => [f.ruleId, f]));

describe("titles state only what was observed", () => {
  const f = byRule();

  it("names the app and only the access that was detected", () => {
    const t = titleFor(f.get("RISKY_THIRD_PARTY_APPS")!, "es");
    expect(t).toBe("Free PDF Merger Pro tiene acceso amplio a Google Drive");
    expect(t).not.toMatch(/correo|Gmail/i);
  });

  it("gives the exact number of days without sign-in", () => {
    expect(titleFor(f.get("INACTIVE_ACCOUNTS")!, "es")).toBe("1 cuenta activa sin iniciar sesión en 140 días");
    expect(titleFor(f.get("INACTIVE_ACCOUNTS")!, "en")).toBe("1 active account with no sign-in for 140 days");
  });

  it("states admin count as evidence, not as a verdict", () => {
    expect(titleFor(f.get("TOO_MANY_ADMINS")!, "es")).toBe("3 cuentas tienen permisos de superadministrador");
  });
});

describe("demo simulated fixes", () => {
  it("removes exactly the risks the owner marked as pending", () => {
    const fixed = byRule(["MFA_MISSING_ADMIN", "PUBLIC_FILES"]);
    expect(fixed.has("MFA_MISSING_ADMIN")).toBe(false);
    expect(fixed.has("PUBLIC_FILES")).toBe(false);
    expect(fixed.has("EXTERNAL_FORWARDING")).toBe(true);
  });

  it("fixes everything when every risk is marked", () => {
    const all = [...byRule().keys()];
    expect(byRule(all).size).toBe(0);
  });
});
