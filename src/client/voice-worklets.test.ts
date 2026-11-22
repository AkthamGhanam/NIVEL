import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { WORKLET_PATHS } from "./voice-worklets";

const fromReactSdk = createRequire(createRequire(import.meta.url).resolve("@elevenlabs/react"));

describe("worklets del SDK servidos desde nuestro origen", () => {
  it("son copias exactas de los del paquete instalado: si el SDK cambia de versión, esta prueba avisa", () => {
    for (const path of Object.values(WORKLET_PATHS)) {
      const name = path.split("/").at(-1) ?? "";
      const served = readFileSync(join(process.cwd(), "public", path), "utf8");
      const packaged = readFileSync(fromReactSdk.resolve(`@elevenlabs/client/worklets/${name}`), "utf8");

      expect(path.startsWith("/elevenlabs/")).toBe(true);
      expect(served).toBe(packaged);
    }
  });
});
