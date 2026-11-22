import type { FeePaymentMethod } from "@/lib/pricing";
import type { FeeStatement } from "@/server/use-cases/billing";
import type { PaymentRow, Receipt } from "@/server/use-cases/payments";
import type { DemoState } from "@/server/use-cases/personas";
import type { CompanyCreated, CompanySignup } from "@/server/use-cases/registration";
import type { NewRating, RatingSubmitted } from "@/server/use-cases/ratings";
import type {
  InvitationSent,
  JobRequestCreated,
  NewJobRequest,
  RequestBoard,
} from "@/server/use-cases/requests";

import type { ApiRequest } from "./api";

/**
 * Todo lo que la pantalla del contratista le pide al servidor, con sus tipos.
 * Solo importa tipos del servidor: ningún código suyo llega al navegador.
 * Cada llamada va con la vista "company", así el servidor usa esa sesión.
 */

export type { DemoState, FeeStatement, PaymentRow, Receipt, RequestBoard };
export type CompanyPersona = DemoState["personas"]["companies"][number];
export type RequestInput = Omit<NewJobRequest, "createdVia">;
export type RatingInput = NewRating;

export type { CompanyCreated };
export type CompanySignupInput = CompanySignup & { readonly consent: true };

export type InviteSelection = { readonly quantity: number } | { readonly workerIds: readonly string[] };

export interface PaymentInput {
  readonly contractId: string;
  readonly method: FeePaymentMethod;
  readonly reference: string;
}

const AS_COMPANY = { as: "company" } as const;
const segment = (id: string) => encodeURIComponent(id);

export function createCompanyApi(request: ApiRequest) {
  const get = <T>(path: string, signal?: AbortSignal) =>
    request<T>(path, signal ? { ...AS_COMPANY, signal } : AS_COMPANY);
  const post = <T>(path: string, body: unknown) => request<T>(path, { ...AS_COMPANY, method: "POST", body });

  return {
    /** Personajes de la demo y con cuál está abierta cada vista. */
    state: (signal?: AbortSignal) => get<DemoState>("/api/state", signal),
    enter: (companyId: string) => post<DemoState>("/api/state", { role: "company", id: companyId }),
    register: (input: CompanySignupInput) =>
      post<{ company: CompanyCreated }>("/api/companies/register", input),

    board: async (signal?: AbortSignal) =>
      (await get<{ board: RequestBoard | null }>("/api/requests/active", signal)).board,
    createRequest: (input: RequestInput) => post<JobRequestCreated>("/api/requests", input),
    /** Invita a los N mejores, o a las personas elegidas de la lista. */
    invite: async (requestId: string, choice: InviteSelection) =>
      (await post<{ invitations: InvitationSent[] }>(`/api/requests/${segment(requestId)}/invite`, choice))
        .invitations,

    registerPayment: (input: PaymentInput) => post<PaymentRow>("/api/payments", input),
    receipt: (paymentId: string, signal?: AbortSignal) =>
      get<Receipt>(`/api/payments/${segment(paymentId)}/receipt`, signal),

    fees: (signal?: AbortSignal) => get<FeeStatement>("/api/fees", signal),
    payFee: (feeId: string, method: FeePaymentMethod) =>
      post<unknown>(`/api/fees/${segment(feeId)}/pay`, { method }),

    rate: (input: RatingInput) => post<RatingSubmitted>("/api/ratings", input),
  };
}

export type CompanyApi = ReturnType<typeof createCompanyApi>;
