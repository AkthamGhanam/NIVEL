import { eq } from "drizzle-orm";

import type { AppContext } from "../context";
import { demoState } from "../db/schema";

/** Claves conocidas del estado de la demo. Cerradas: no se aceptan claves arbitrarias. */
export const DEMO_KEYS = Object.freeze([
  "active_company_id",
  "active_worker_id",
  "bot",
  "simulation",
  "example_rate_bs_per_usd",
  "site",
] as const);
export type DemoKey = (typeof DEMO_KEYS)[number];

export async function getDemoValue(context: AppContext, key: DemoKey): Promise<string | undefined> {
  const [row] = await context.db.select().from(demoState).where(eq(demoState.key, key));
  return row?.value;
}

export async function isDemoFlagOn(context: AppContext, key: "bot" | "simulation"): Promise<boolean> {
  return (await getDemoValue(context, key)) === "on";
}

export async function setDemoValue(context: AppContext, key: DemoKey, value: string): Promise<void> {
  await context.db
    .insert(demoState)
    .values({ key, value })
    .onConflictDoUpdate({ target: demoState.key, set: { value } });
}
