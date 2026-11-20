import "server-only";
import { cookies } from "next/headers";

/**
 * Each visitor of the demo gets their own copy of the fictional company, so one
 * visitor marking a risk as fixed never changes what another visitor sees.
 * The id is an anonymous random UUID in a cookie (set by proxy.ts): no personal data.
 * With a real Google tenant there is only one owner, so everything uses "owner".
 */

export const SESSION_COOKIE = "demo_sid";
export const OWNER_SESSION = "owner";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isValidSessionId(value: string | undefined): value is string {
  return typeof value === "string" && UUID.test(value);
}

export async function currentSessionId(): Promise<string> {
  if (process.env.DATA_SOURCE === "google") return OWNER_SESSION;
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  // proxy.ts always sets a valid id; fall back to a shared bucket rather than crash.
  return isValidSessionId(value) ? value : "anonymous";
}
