export const TRADES = Object.freeze([
  "soldador",
  "electricista",
  "albanil",
  "plomero",
  "pintor",
  "otro",
] as const);
export type Trade = (typeof TRADES)[number];

/** Cómo se nombra cada oficio al hablar o mostrarlo. */
export const TRADE_LABELS: Readonly<Record<Trade, { readonly singular: string; readonly plural: string }>> =
  Object.freeze({
    soldador: { singular: "soldador", plural: "soldadores" },
    electricista: { singular: "electricista", plural: "electricistas" },
    albanil: { singular: "albañil", plural: "albañiles" },
    plomero: { singular: "plomero", plural: "plomeros" },
    pintor: { singular: "pintor", plural: "pintores" },
    otro: { singular: "trabajador", plural: "trabajadores" },
  });

export const CONTRACT_TYPES = Object.freeze([
  "obra_determinada",
  "tiempo_determinado",
  "servicio_independiente",
] as const);
export type ContractType = (typeof CONTRACT_TYPES)[number];
