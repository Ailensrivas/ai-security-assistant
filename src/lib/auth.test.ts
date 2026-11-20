import { afterEach, describe, expect, it, vi } from "vitest";
import { isAuthorized } from "./auth";

const basic = (user: string, pass: string) => "Basic " + btoa(`${user}:${pass}`);

describe("isAuthorized", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts the right password", () => {
    vi.stubEnv("APP_PASSWORD", "s3cret");
    expect(isAuthorized(basic("owner", "s3cret"))).toBe(true);
  });

  it("rejects a wrong password, wrong user, or no header", () => {
    vi.stubEnv("APP_PASSWORD", "s3cret");
    expect(isAuthorized(basic("owner", "nope"))).toBe(false);
    expect(isAuthorized(basic("admin", "s3cret"))).toBe(false);
    expect(isAuthorized(null)).toBe(false);
    expect(isAuthorized("Basic !!!not-base64")).toBe(false);
  });

  it("opens the public demo only with the fictional company", () => {
    vi.stubEnv("APP_PASSWORD", "s3cret");
    vi.stubEnv("PUBLIC_DEMO", "true");
    vi.stubEnv("DATA_SOURCE", "demo");
    expect(isAuthorized(null)).toBe(true);
    vi.stubEnv("DATA_SOURCE", "google"); // a real tenant can never be public
    expect(isAuthorized(null)).toBe(false);
  });

  it("fails closed in production when no password is configured", () => {
    vi.stubEnv("APP_PASSWORD", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(isAuthorized(null)).toBe(false);
  });
});
