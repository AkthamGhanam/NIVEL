import type { evaluatePracticalTest, getAcademyPanel, issueConstancia } from "@/server/use-cases/academy";
import type { DemoState } from "@/server/use-cases/personas";

import type { ApiRequest } from "./api";

/**
 * Lo que el panel de la academia le pide al servidor, con sus tipos. Solo
 * importa tipos del servidor. Cada llamada va con la vista "academy".
 */

export type { DemoState };
export type AcademyPersona = DemoState["personas"]["academies"][number];
export type AcademyPanel = Awaited<ReturnType<typeof getAcademyPanel>>;
export type TestEvaluated = Awaited<ReturnType<typeof evaluatePracticalTest>>;
export type ConstanciaIssued = Awaited<ReturnType<typeof issueConstancia>>;

const AS_ACADEMY = { as: "academy" } as const;
const segment = (id: string) => encodeURIComponent(id);

export function createAcademyApi(request: ApiRequest) {
  const get = <T>(path: string, signal?: AbortSignal) =>
    request<T>(path, signal ? { ...AS_ACADEMY, signal } : AS_ACADEMY);
  const post = <T>(path: string, body: unknown) => request<T>(path, { ...AS_ACADEMY, method: "POST", body });

  return {
    state: (signal?: AbortSignal) => get<DemoState>("/api/state", signal),
    enter: (academyId: string) => post<DemoState>("/api/state", { role: "academy", id: academyId }),

    panel: (signal?: AbortSignal) => get<AcademyPanel>("/api/academy", signal),
    /** Registra la nota de una prueba práctica. El servidor decide si aprueba y recalcula el nivel. */
    evaluate: (testId: string, score: number) =>
      post<TestEvaluated>(`/api/practical-tests/${segment(testId)}/evaluate`, { score }),
    issueConstancia: (enrollmentId: string) =>
      post<ConstanciaIssued>(`/api/enrollments/${segment(enrollmentId)}/constancia`, {}),
  };
}

export type AcademyApi = ReturnType<typeof createAcademyApi>;
