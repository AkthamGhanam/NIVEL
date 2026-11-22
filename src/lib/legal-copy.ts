/**
 * Textos fijos que exige la revisión legal (docs/spec.md, sección 8). Viven en
 * un solo lugar para que la interfaz, los contratos y los agentes digan lo mismo.
 */

/** Regla 8.1: va en ofertas, contrato y aceptación. */
export const NOT_EMPLOYER_NOTICE =
  "Contrato directo empresa–trabajador. NIVEL es la plataforma, no el patrono.";

/** Pie de todas las pantallas de la demo. */
export const DEMO_FOOTER = "Demo · nombres, empresas y cifras de ejemplo";

/** Regla 8.3: junto a todo formulario de calificación. */
export const PRIVATE_RATING_NOTICE = "Tu calificación es privada y le ayuda a mejorar.";
export const BLIND_RATING_NOTICE = "La empresa verá tu calificación cuando ella también te califique.";

/** Regla 8.4: confirmación de todo reporte. */
export const HUMAN_REVIEW_NOTICE =
  "Una persona del equipo de NIVEL revisa tu reporte en menos de 24 horas. La empresa no sabrá que fuiste tú y tu nivel no cambia.";

/** Regla 8.8: junto a toda tarifa de NIVEL. */
export const FEE_PAYMENT_NOTICE =
  "Se paga en bolívares por Pago Móvil o transferencia. Factura digital (simulada).";
export const EXAMPLE_RATE_LABEL = "tasa de ejemplo";

/** Regla 8.9: antes de confirmar un reemplazo. */
export const REPLACEMENT_WARNING =
  "Terminar un contrato antes de tiempo tiene consecuencias legales. Una falta aislada no es causa justificada: la ley habla de 3 días hábiles de inasistencia injustificada en un mes. Los días trabajados se pagan.";
export const SEARCH_GUARANTEE_NOTICE =
  "Garantía de búsqueda de 7 días: si la contratación no funciona, buscamos a otra persona sin cobrar otra tarifa.";

/** La banda salarial es una referencia, nunca una promesa. */
export const REFERENCE_BAND_NOTICE = "Referencia de mercado. No es una promesa de salario.";

/** Regla 8.11: palabras que no pueden aparecer en la interfaz ni en el pitch. */
export const FORBIDDEN_WORDS = Object.freeze([
  "garantizado",
  "garantizada",
  "certificado oficial",
  "100% verificado",
  "100 % verificado",
  "sin riesgo laboral",
  "sin pasivos",
  "zelle",
  "usdt",
] as const);
