"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { isAuthorized } from "@/lib/auth";
import { resetScans, setDecision } from "@/lib/db";
import { dataSource, runScan } from "@/lib/scan";
import { currentSessionId } from "@/lib/session";
import type { Decision } from "@/lib/types";

/** Server actions are public endpoints: check access again here, not only in proxy.ts. */
async function assertAuthorized() {
  const h = await headers();
  if (!isAuthorized(h.get("authorization"))) {
    throw new Error("Unauthorized");
  }
}

export async function runScanAction(): Promise<void> {
  await assertAuthorized();
  // If the hourly limit is reached the page simply shows the last check
  // (the page reads the same limit and shows a note).
  await runScan(await currentSessionId());
  refresh();
}

const DECISIONS: ReadonlySet<string> = new Set<Decision>(["open", "pending", "accepted"]);

export async function decideAction(formData: FormData): Promise<void> {
  await assertAuthorized();
  // Never trust form input: validate both fields.
  const id = Number(formData.get("findingId"));
  const decision = String(formData.get("decision"));
  if (!Number.isInteger(id) || id <= 0 || !DECISIONS.has(decision)) {
    throw new Error("Invalid request");
  }
  setDecision(await currentSessionId(), id, decision as Decision);
  refresh();
}

/** Demo only: start over with all the planted problems. */
export async function resetDemoAction(): Promise<void> {
  await assertAuthorized();
  if (dataSource() !== "demo") throw new Error("Reset is only available in demo mode");
  resetScans(await currentSessionId());
  refresh();
}
