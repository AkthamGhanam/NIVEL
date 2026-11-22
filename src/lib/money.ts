import { ensure } from "./errors";

/**
 * Dinero en centavos enteros para evitar errores de coma flotante.
 * Las funciones públicas reciben y devuelven dólares con 2 decimales.
 */

const CENTS_PER_UNIT = 100;

export const toCents = (amount: number): number => Math.round(amount * CENTS_PER_UNIT);
export const fromCents = (cents: number): number => cents / CENTS_PER_UNIT;

/** Redondeo comercial a 2 decimales. */
export const round2 = (amount: number): number => fromCents(toCents(amount));

export function assertMoney(amount: number, label: string): void {
  ensure(Number.isFinite(amount) && amount >= 0, `${label} debe ser un monto no negativo`);
}
