/**
 * Simple access control for a single-owner deployment: HTTP Basic auth with
 * a password from APP_PASSWORD. Checked in proxy.ts for every request AND
 * again inside every server action (defense in depth).
 *
 * Kept free of Node-only imports so it also runs in the proxy.
 */

export const AUTH_USER = "owner";

/** PUBLIC_DEMO=true opens the app without a password, and only works with DATA_SOURCE=demo. */
export function isPublicDemo(): boolean {
  return process.env.PUBLIC_DEMO === "true" && process.env.DATA_SOURCE !== "google";
}

/** Constant-time string comparison, so response time does not leak the password. */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Returns true if the Authorization header has the right password.
 * If APP_PASSWORD is not set: allowed in development, denied in production
 * (fail closed, so a forgotten variable never exposes the dashboard).
 */
export function isAuthorized(authorizationHeader: string | null): boolean {
  // Public demo: open to anyone, but ONLY with the fictional company.
  // It can never be combined with a real Google tenant.
  if (isPublicDemo()) return true;
  const password = process.env.APP_PASSWORD;
  if (!password) return process.env.NODE_ENV !== "production";
  if (!authorizationHeader?.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    decoded = atob(authorizationHeader.slice(6));
  } catch {
    return false;
  }
  const sep = decoded.indexOf(":");
  if (sep < 0) return false;
  return safeEqual(decoded.slice(0, sep), AUTH_USER) && safeEqual(decoded.slice(sep + 1), password);
}
