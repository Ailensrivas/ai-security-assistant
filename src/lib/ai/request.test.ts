import { describe, expect, it } from "vitest";
import { demoSnapshot } from "../collectors/demo";
import { evaluate } from "../rules";
import { SYSTEM_PROMPT, buildUserMessage } from "./request";

const NOW = new Date("2026-11-18T12:00:00Z");

describe("what is sent to the AI", () => {
  const snapshot = demoSnapshot(NOW);
  const findings = evaluate(snapshot, NOW);
  const sent = SYSTEM_PROMPT + "\n" + buildUserMessage(findings, 15);

  it("contains every finding's rule id", () => {
    for (const f of findings) expect(sent).toContain(f.ruleId);
  });

  it("never contains emails, names, file names, app names or the domain", () => {
    const secrets = [
      snapshot.domain,
      snapshot.organizationName,
      ...snapshot.users.flatMap((u) => [u.email, u.name]),
      ...snapshot.forwarding.flatMap((f) => [f.ownerEmail, f.forwardTo]),
      ...snapshot.publicFiles.map((f) => f.fileName),
      ...snapshot.thirdPartyApps.map((a) => a.appName),
      ...findings.flatMap((f) => f.affected),
    ];
    for (const s of secrets) expect(sent).not.toContain(s);
    expect(sent).not.toContain("@");
  });

  it("does not let the trap file's text reach the model", () => {
    expect(sent).not.toMatch(/IGNORE PREVIOUS INSTRUCTIONS/i);
  });

  it("sends only the kind of access that was detected", () => {
    expect(sent).toContain('"drive"');
    expect(sent).not.toContain('"gmail"');
  });
});
