export const TRADES = Object.freeze([
  "soldador",
  "electricista",
  "albanil",
  "plomero",
  "pintor",
  "otro",
] as const);
export type Trade = (typeof TRADES)[number];

export const CONTRACT_TYPES = Object.freeze([
  "obra_determinada",
  "tiempo_determinado",
  "servicio_independiente",
] as const);
export type ContractType = (typeof CONTRACT_TYPES)[number];
