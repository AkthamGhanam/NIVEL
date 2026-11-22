import { describe, expect, it } from "vitest";

import { estimateLegalCost } from "./legal-cost";
import { hiringFeeRange } from "./pricing";
import {
  type RequestSummary,
  SAY_UNDERAGE,
  sayInvited,
  sayLegalCost,
  sayOffer,
  sayOfferAnswered,
  sayOffers,
  sayProfileCreated,
  sayRequestCreated,
  spokenDate,
} from "./say";

const SCRIPT: RequestSummary = {
  trade: "soldador",
  quantity: 3,
  minLevel: 2,
  zone: "Los Guayos",
  days: 5,
  matching: 6,
  legalCost: estimateLegalCost({ dailyPayUsd: 25, days: 5, quantity: 3 }),
  feeRange: hiringFeeRange(2, 3),
};

const OFFER = {
  companyName: "Constructora Los Guayos",
  trade: "soldador",
  zone: "Los Guayos",
  startDate: "2026-11-24",
  days: 5,
  dailyPayUsd: 25,
} as const;

/** Regla legal 8.10: palabras que la app nunca usa. */
const FORBIDDEN =
  /garantizad|certificado oficial|100\s?% verificado|sin riesgo laboral|sin pasivos|zelle|usdt/i;

describe("sayRequestCreated", () => {
  it("dice la frase del guion para el pedido de 3 soldadores", () => {
    expect(sayRequestCreated(SCRIPT)).toBe(
      "Listo. 6 soldadores de nivel 2 o más cumplen cerca de Los Guayos. " +
        "El costo legal estimado es de unos 197 dólares por persona por los 5 días. " +
        "La tarifa de NIVEL va de 20 a 30 dólares por contratación según el nivel, más IVA. " +
        "¿Invito a los 3 mejores?",
    );
  });

  it("avisa cuando cumplen menos de los pedidos y ofrece invitar solo a esos", () => {
    const said = sayRequestCreated({ ...SCRIPT, matching: 1, feeRange: hiringFeeRange(3, 3), days: 1 });

    expect(said).toContain("1 soldador de nivel 2 o más cumple cerca de Los Guayos.");
    expect(said).toContain("Pediste 3, así que por ahora faltarían 2.");
    expect(said).toContain("por 1 día");
    expect(said).toContain("es de 30 dólares por contratación");
    expect(said).toMatch(/¿Invito a esa persona\?$/);
  });

  it("si nadie cumple propone cambiar el nivel o la fecha, sin inventar candidatos", () => {
    const said = sayRequestCreated({ ...SCRIPT, trade: "albanil", minLevel: 5, matching: 0, feeRange: null });

    expect(said).toBe(
      "No encontré albañiles de nivel 5 disponibles cerca de Los Guayos para esas fechas. " +
        "¿Probamos con otro nivel mínimo o con otra fecha?",
    );
  });
});

describe("otras frases del contratista", () => {
  it("nombra a los invitados con su nombre corto", () => {
    expect(sayInvited(["Rafael T.", "José P.", "Luis M."])).toBe(
      "Invité a Rafael T., José P. y Luis M. Te aviso en pantalla cuando respondan.",
    );
    expect(sayInvited(["Carlos R."])).toContain("Invité a Carlos R.");
    expect(sayInvited([])).toContain("Ya no quedan candidatos");
  });

  it("el costo legal siempre se presenta como estimado", () => {
    const crew = sayLegalCost(SCRIPT.legalCost, 5);
    const single = sayLegalCost(estimateLegalCost({ dailyPayUsd: 25, days: 1, quantity: 1 }), 1);

    expect(crew).toContain("Para 3 personas durante 5 días");
    expect(crew).toContain("unos 590 dólares en total, unos 197 dólares por persona");
    expect(crew).toMatch(/Estimado\. Valídalo con tu contador\.$/);
    expect(single).toContain("Para 1 persona durante 1 día");
  });
});

describe("frases del trabajador", () => {
  it("lee la fecha como se dice en Venezuela", () => {
    expect(spokenDate("2026-11-24")).toBe("martes, 24 de noviembre");
  });

  it("una invitación cabe en una frase, con un día en singular", () => {
    expect(sayOffer({ ...OFFER, days: 1 })).toBe(
      "Constructora Los Guayos te invita como soldador en Los Guayos: " +
        "1 día desde el martes, 24 de noviembre, a 25 dólares diarios.",
    );
  });

  it("cuenta la primera invitación y pregunta si la acepta", () => {
    expect(sayOffers([])).toContain("No tienes invitaciones abiertas");
    expect(sayOffers([OFFER])).toBe(
      "Tienes 1 invitación. Constructora Los Guayos te invita como soldador en Los Guayos: " +
        "5 días desde el martes, 24 de noviembre, a 25 dólares diarios. ¿La aceptas?",
    );
    expect(sayOffers([{ ...OFFER, days: 1 }, OFFER])).toContain(
      "Tienes 2 invitaciones. Te cuento la primera.",
    );
  });

  it("al aceptar recuerda que NIVEL no es el patrono", () => {
    expect(sayOfferAnswered(true, "Constructora Los Guayos")).toContain("NIVEL no es tu patrono");
    expect(sayOfferAnswered(false, "Constructora Los Guayos")).toContain("rechazaste");
  });

  it("al crear el perfil explica cómo subir y que la banda es solo una referencia", () => {
    const full = sayProfileCreated({
      firstName: "María",
      freeCourse: "Seguridad en trabajos en caliente",
      recommendedCourse: "Soldadura SMAW en estructuras",
    });
    const bare = sayProfileCreated({ firstName: "Pedro", freeCourse: null, recommendedCourse: null });

    expect(full).toContain("Listo, María. Tu perfil quedó en Nivel 1: Aprendiz.");
    expect(full).toContain("Aprueba la prueba práctica o consigue 1 constancia de academia para Nivel 2");
    expect(full).toContain('curso gratis "Seguridad en trabajos en caliente"');
    expect(full).toContain("de 160 a 240 dólares al mes. Es solo una referencia, no una promesa de salario.");
    expect(bare).not.toContain("curso");
  });
});

describe("reglas legales", () => {
  it("ninguna frase usa palabras prohibidas ni promete empleo", () => {
    const everything = [
      sayRequestCreated(SCRIPT),
      sayRequestCreated({ ...SCRIPT, matching: 0, feeRange: null }),
      sayInvited(["Rafael T."]),
      sayLegalCost(SCRIPT.legalCost, 5),
      sayOffers([OFFER]),
      sayOfferAnswered(true, "X"),
      sayProfileCreated({ firstName: "Ana", freeCourse: "A", recommendedCourse: "B" }),
      SAY_UNDERAGE,
    ].join(" ");

    expect(everything).not.toMatch(FORBIDDEN);
    expect(everything).not.toMatch(/te conseguimos|empleo seguro/i);
  });
});
