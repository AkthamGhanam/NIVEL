import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildSeed } from "../../src/server/db/seed/build";
import { CLIPS } from "./catalog";

/**
 * Los audios pregenerados se commitean: la demo no puede apuntar a un archivo
 * que no existe. Si cambia un guion, `npm run audio:gen` regenera solo ese.
 */

const PUBLIC_DIR = join(process.cwd(), "public");
const manifest = JSON.parse(readFileSync(join(PUBLIC_DIR, "audio", "manifest.json"), "utf8")) as Record<
  string,
  string
>;

describe("audios pregenerados", () => {
  it("cada lección del seed apunta a un audio que existe y está en el catálogo", () => {
    const urls = new Set(CLIPS.map((clip) => clip.url));

    for (const lesson of buildSeed(new Date("2026-11-22T06:30:00Z")).lessons) {
      expect(lesson.audioUrl, lesson.id).toBeTruthy();
      expect(urls.has(lesson.audioUrl as string), lesson.id).toBe(true);
      expect(existsSync(join(PUBLIC_DIR, lesson.audioUrl as string)), lesson.id).toBe(true);
    }
  });

  it("toda voz del catálogo está generada y registrada en el manifiesto", () => {
    for (const clip of CLIPS.filter((candidate) => candidate.kind === "speech")) {
      expect(existsSync(join(PUBLIC_DIR, clip.url)), clip.url).toBe(true);
      expect(manifest[clip.url], clip.url).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("todo audio del manifiesto existe en disco", () => {
    for (const url of Object.keys(manifest)) expect(existsSync(join(PUBLIC_DIR, url)), url).toBe(true);
  });

  it("los efectos duran 1,5 s como máximo y las URL no se repiten", () => {
    const sounds = CLIPS.filter((clip) => clip.kind === "sound");

    expect(sounds.every((clip) => clip.seconds <= 1.5)).toBe(true);
    expect(new Set(CLIPS.map((clip) => clip.url)).size).toBe(CLIPS.length);
  });
});
