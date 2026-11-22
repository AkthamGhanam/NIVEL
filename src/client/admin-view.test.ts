// Pruebas de admin-view.
import { describe, expect, it } from "vitest";

import {
  formatCrewTime,
  incomeRows,
  levelRows,
  parseReviewNote,
  queueSummary,
  reportView,
  REVIEW_NOTE_MAX_LENGTH,
  sameSiteAudio,
} from "./admin-view";
import type { ReportRow } from "./team-api";

const NOW = new Date("2026-11-22T18:00:00.000Z");
const COMPANIES = [
  {
    id: "co-guayos",
    name: "Constructora Los Guayos",
    zone: "Los Guayos",
    rif: "J-50123456-7",
    verified: true,
    registered: false,
  },
];

const report = (changes: Partial<ReportRow> = {}): ReportRow => ({
  id: "re-1",
  reporterWorkerId: "w-carlos",
  companyId: "co-guayos",
  kind: "inseguridad",
  text: null,
  audioUrl: null,
  transcript: "No había extintor en el área de soldadura.",
  status: "en_revision",
  reviewerNote: null,
  createdAt: "2026-11-22T14:00:00.000Z",
  reviewedAt: null,
  ...changes,
});

describe("métricas", () => {
  it("el tiempo a cuadrilla completa se lee en segundos o minutos, y sin datos lo dice", () => {
    expect(formatCrewTime(null)).toBe("Sin datos");
    expect(formatCrewTime(0.15)).toBe("9 s");
    expect(formatCrewTime(3.46)).toBe("3,5 min");
    expect(formatCrewTime(1)).toBe("1 min");
  });

  it("reparte a los trabajadores en los cinco niveles, también los vacíos", () => {
    const rows = levelRows({ total: 40, real: 2, byLevel: { 1: 10, 2: 20, 3: 10 } });

    expect(rows.map((row) => row.count)).toEqual([10, 20, 10, 0, 0]);
    expect(rows[1]).toEqual({ level: 2, name: "Verificado", count: 20, share: 0.5 });
    expect(levelRows({ total: 0, real: 0, byLevel: {} }).every((row) => row.share === 0)).toBe(true);
  });

  it("los ingresos van por origen y el total al final, con el IVA aparte", () => {
    const hiring = { base: 100, iva: 16, total: 116 };
    const academyCommission = { base: 18, iva: 2.88, total: 20.88 };
    const total = { base: 118, iva: 18.88, total: 136.88 };
    const rows = incomeRows({ hiring, academyCommission, total, pendingTotalUsd: 34.8 });

    expect(rows.map((row) => row.label)).toEqual([
      "Tarifas por contratación",
      "Comisión de academias (15 %)",
      "Total",
    ]);
    expect(rows.map((row) => row.total)).toEqual([false, false, true]);
    expect(rows[2]?.price).toBe(total);
  });
});

describe("cola de revisión humana", () => {
  it("muestra qué pasó, contra quién y cuánto queda del plazo, sin decir quién reportó", () => {
    const view = reportView(report(), COMPANIES, NOW);

    expect(view).toEqual({
      id: "re-1",
      kind: "Inseguridad en la obra",
      body: "No había extintor en el área de soldadura.",
      source: "Nota de voz transcrita",
      company: "Constructora Los Guayos",
      received: "dom 22 nov, 10:00 a. m.",
      deadline: "Quedan 20 h de las 24",
      overdue: false,
      audioUrl: null,
      safetyReminder: true,
    });
    expect(JSON.stringify(view)).not.toContain("w-carlos");
  });

  it("distingue el reporte escrito, el vacío y el que no nombra empresa", () => {
    const written = reportView(
      report({ transcript: null, text: "No me pagaron.", kind: "no_pago" }),
      [],
      NOW,
    );
    const empty = reportView(report({ transcript: null, companyId: null }), COMPANIES, NOW);

    expect(written.source).toBe("Escrito por la persona");
    expect(written.kind).toBe("Falta de pago");
    expect(written.company).toBeNull();
    expect(written.safetyReminder).toBe(false);
    expect(empty.source).toBe("Sin texto");
    expect(empty.company).toBeNull();
  });

  it("avisa cuando el plazo de 24 horas ya venció", () => {
    const late = reportView(report({ createdAt: "2026-11-21T17:00:00.000Z" }), COMPANIES, NOW);
    const lastHour = reportView(report({ createdAt: "2026-11-21T18:30:00.000Z" }), COMPANIES, NOW);

    expect(late).toMatchObject({ deadline: "Plazo de 24 h vencido", overdue: true });
    expect(lastHour).toMatchObject({ deadline: "Quedan 1 h de las 24", overdue: false });
  });

  it("con el reloj atrasado no promete más horas de las que hay", () => {
    const fromTheFuture = reportView(report({ createdAt: "2026-11-22T19:30:00.000Z" }), COMPANIES, NOW);

    expect(fromTheFuture.deadline).toBe("Quedan 24 h de las 24");
  });

  it("solo reproduce audio servido por la propia app", () => {
    expect(sameSiteAudio("/audio/reportes/re-1.webm")).toBe("/audio/reportes/re-1.webm");
    expect(sameSiteAudio("https://otro.example/a.webm")).toBeNull();
    expect(sameSiteAudio("//otro.example/a.webm")).toBeNull();
    expect(sameSiteAudio("/\\otro.example/a.webm")).toBeNull();
    expect(sameSiteAudio("javascript:alert(1)")).toBeNull();
    expect(sameSiteAudio(null)).toBeNull();
  });

  it("resume la cola con concordancia", () => {
    expect(queueSummary(0)).toBe("No hay reportes por revisar.");
    expect(queueSummary(1)).toBe("1 reporte espera la decisión de una persona del equipo.");
    expect(queueSummary(3)).toBe("3 reportes esperan la decisión de una persona del equipo.");
  });

  it("la decisión exige una nota, y la nota tiene un largo máximo", () => {
    expect(parseReviewNote("   ")).toEqual({
      ok: false,
      error: "Escribe una nota que explique la decisión.",
    });
    expect(parseReviewNote("  Se habló con la empresa.  ")).toEqual({
      ok: true,
      note: "Se habló con la empresa.",
    });
    expect(parseReviewNote("x".repeat(REVIEW_NOTE_MAX_LENGTH + 1))).toMatchObject({ ok: false });
    expect(parseReviewNote("x".repeat(REVIEW_NOTE_MAX_LENGTH))).toMatchObject({ ok: true });
  });
});
