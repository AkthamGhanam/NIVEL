import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Actor } from "../actor";
import { type AppContext, createContext } from "../context";
import { type DatabaseHandle, migrate, openDatabase } from "../db/client";
import { resetDemo } from "../db/reset";
import { IDS } from "../db/seed/cast";

/** Domingo 22 de noviembre de 2026, 2:30 a. m. en Caracas: el día de la demo. */
export const DEMO_NOW = new Date("2026-11-22T06:30:00Z");

export const TEST_SECRET = "secreto-de-pruebas-de-32-caracteres!";

export const ACTORS = {
  company: { role: "company", companyId: IDS.activeCompany },
  otherCompany: { role: "company", companyId: "co-moron" },
  carlos: { role: "worker", workerId: IDS.carlos },
  rafael: { role: "worker", workerId: IDS.rafael },
  jose: { role: "worker", workerId: IDS.jose },
  luis: { role: "worker", workerId: IDS.luis },
  admin: { role: "admin" },
} as const satisfies Record<string, Actor>;

export interface TestApp {
  readonly handle: DatabaseHandle;
  readonly context: AppContext;
  /** Adelanta el reloj de la prueba. */
  readonly setNow: (now: Date) => void;
  readonly close: () => void;
}

/** Base de datos temporal con el seed canónico y un reloj controlable. */
export async function createTestApp(): Promise<TestApp> {
  const directory = mkdtempSync(join(tmpdir(), "nivel-test-"));
  const handle = openDatabase({ url: `file:${join(directory, "test.db")}` });
  await migrate(handle);
  await resetDemo(handle, { now: DEMO_NOW, keepRealWorkers: false });
  let now = DEMO_NOW;
  return {
    handle,
    context: createContext({ db: handle.db, secret: TEST_SECRET, now: () => now }),
    setNow: (next) => {
      now = next;
    },
    close: () => {
      handle.client.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
