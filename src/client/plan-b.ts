import { sayInvited, sayRequestCreated } from "@/lib/say";

import type { CompanyApi, RequestInput } from "./company-api";
import type { Script } from "./scripted-nivi";

/**
 * Guion del Plan B para la empresa: el camino dorado de la demo (3 soldadores
 * de Nivel 2 por 5 días). Cada paso usa la misma API que el formulario, así
 * que la base y la bitácora quedan igual que en una conversación de verdad.
 */

/** Solo `?planb=1` lo activa; cualquier otro valor se ignora. */
export const isPlanB = (value: unknown): boolean => value === "1";

/** Saludo del agente de la empresa (sección 7.4 de la especificación). */
export const CONTRACTOR_OPENING =
  "Hola, soy Nivi de NIVEL. Dime qué gente necesitas y para cuándo, y te armo la cuadrilla.";

export const CONTRACTOR_CLOSING =
  "Listo por ahora. En el tablero verás quién acepta, y ahí mismo puedes invitar a más personas.";

const GOLDEN_REQUEST = Object.freeze({
  trade: "soldador",
  quantity: 3,
  minLevel: 2,
  startDate: "el martes",
  days: 5,
  dailyPayUsd: 25,
  contractType: "obra_determinada",
} satisfies Omit<RequestInput, "zone" | "via">);

export interface ContractorScriptDeps {
  readonly api: Pick<CompanyApi, "createRequest" | "invite">;
  /** Zona de la empresa: allí es la obra del guion. */
  readonly zone: string;
  /** Tras cada paso se pide el tablero de nuevo para que la pantalla lo muestre de una vez. */
  readonly refresh: () => Promise<unknown>;
}

export function contractorScript({ api, zone, refresh }: ContractorScriptDeps): Script {
  let requestId: string | undefined;
  let toInvite: number = GOLDEN_REQUEST.quantity;
  return {
    opening: CONTRACTOR_OPENING,
    closing: CONTRACTOR_CLOSING,
    steps: [
      {
        persona: `Necesito 3 soldadores de Nivel 2 o más en ${zone}, por 5 días desde el martes, a 25 dólares diarios.`,
        run: async () => {
          const created = await api.createRequest({ ...GOLDEN_REQUEST, zone, via: "voz" });
          requestId = created.request.id;
          toInvite = Math.min(GOLDEN_REQUEST.quantity, created.matching);
          await refresh();
          const { matching, legalCost, feeRange } = created;
          return sayRequestCreated({ ...GOLDEN_REQUEST, zone, matching, legalCost, feeRange });
        },
      },
      {
        persona: "Sí, invítalos.",
        run: async () => {
          if (!requestId || toInvite === 0) return sayInvited([]);
          const sent = await api.invite(requestId, { quantity: toInvite });
          await refresh();
          return sayInvited(sent.map(({ candidate }) => candidate.shortName));
        },
      },
    ],
  };
}
