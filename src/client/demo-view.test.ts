import { describe, expect, it } from "vitest";

import { crewTimer, crewTimerLabel, eventLine, eventLines, formatClock, formatLatency } from "./demo-view";
import type { EventRow } from "./team-api";

const event = (changes: Partial<EventRow>): EventRow => ({
  id: "ev-1",
  ts: "2026-11-22T16:30:00.000Z",
  actor: "Constructora Los Guayos",
  type: "solicitud_creada",
  label: "Solicitud: 3 soldadores · 6 cumplen",
  detail: { requestId: "jr-1" },
  latencyMs: null,
  product: "app",
  ...changes,
});

describe("líneas de la bitácora", () => {
  it("muestra la hora de Caracas, quién y qué, y la insignia solo cuando hay producto o latencia", () => {
    expect(eventLine(event({}))).toEqual({
      id: "ev-1",
      time: "12:30 p. m.",
      actor: "Constructora Los Guayos",
      label: "Solicitud: 3 soldadores · 6 cumplen",
      badge: null,
    });
    expect(eventLine(event({ product: "agents", latencyMs: 820 })).badge).toBe("ElevenAgents · 820 ms");
    expect(eventLine(event({ product: "stt", latencyMs: 1234 })).badge).toBe("Scribe v2 · 1,2 s");
    expect(eventLine(event({ product: "tts" })).badge).toBe("Texto a voz");
    expect(eventLine(event({ product: "sfx", latencyMs: 90.4 })).badge).toBe("Efectos de sonido · 90 ms");
    expect(eventLine(event({ latencyMs: 15 })).badge).toBe("15 ms");
  });

  it("no repite el nombre cuando el texto ya empieza con quien lo hizo", () => {
    const accepted = eventLine(event({ actor: "Carlos R.", label: "Carlos R. aceptó la invitación" }));

    expect(accepted.actor).toBe("Carlos R.");
    expect(accepted.label).toBe("aceptó la invitación");
    expect(eventLine(event({ actor: "NIVEL", label: "NIVELES publicados" })).label).toBe(
      "NIVELES publicados",
    );
  });

  it("lo más reciente va arriba", () => {
    const lines = eventLines([event({ id: "a" }), event({ id: "b" }), event({ id: "c" })]);

    expect(lines.map((line) => line.id)).toEqual(["c", "b", "a"]);
  });

  it("latencias y reloj se leen como en el guion", () => {
    expect(formatLatency(999)).toBe("999 ms");
    expect(formatLatency(1000)).toBe("1,0 s");
    expect(formatClock(47)).toBe("00:47");
    expect(formatClock(125.9)).toBe("02:05");
    expect(formatClock(-4)).toBe("00:00");
  });
});

describe("contador de la cuadrilla", () => {
  const created = event({});
  const complete = event({
    id: "ev-9",
    type: "cuadrilla_completa",
    ts: "2026-11-22T16:30:47.000Z",
    detail: { requestId: "jr-1", seconds: 47 },
  });
  const now = new Date("2026-11-22T16:30:12.000Z");

  it("sin solicitud no corre", () => {
    expect(crewTimer([])).toEqual({ state: "idle" });
    expect(crewTimerLabel(crewTimer([complete]), now)).toBe("Aún no hay una solicitud");
  });

  it("corre desde que se crea la solicitud y nunca muestra tiempo negativo", () => {
    const timer = crewTimer([created, event({ id: "ev-2", type: "invitacion_aceptada" })]);

    expect(timer).toEqual({ state: "running", since: created.ts });
    expect(crewTimerLabel(timer, now)).toBe("Armando la cuadrilla · 00:12");
    expect(crewTimerLabel(timer, new Date("2026-11-22T16:29:00.000Z"))).toBe("Armando la cuadrilla · 00:00");
  });

  it("se detiene con la cifra que midió el servidor cuando la cuadrilla queda completa", () => {
    const timer = crewTimer([created, complete]);

    expect(timer).toEqual({ state: "done", seconds: 47 });
    expect(crewTimerLabel(timer, now)).toBe("Cuadrilla armada en 00:47");
  });

  it("una solicitud nueva vuelve a poner el contador en marcha", () => {
    const again = event({ id: "ev-10", ts: "2026-11-22T17:00:00.000Z", detail: { requestId: "jr-2" } });
    const foreign = { ...complete, detail: { requestId: "jr-1", seconds: "mucho" } };

    expect(crewTimer([created, complete, again])).toEqual({ state: "running", since: again.ts });
    expect(crewTimer([created, foreign]).state).toBe("running");
  });
});
