// Todo lo que la app del trabajador le pide al servidor, con sus tipos.
import type { GeoPoint } from "@/lib/geo";
import type { AttendanceRow } from "@/server/use-cases/attendance";
import type { ContractDetail, PublicContract } from "@/server/use-cases/contracts";
import type { InvitationResponse, WorkerOffer } from "@/server/use-cases/invitations";
import type { MyRoute } from "@/server/use-cases/learning";
import type { LevelStatus } from "@/server/use-cases/levels";
import type { PaymentRow } from "@/server/use-cases/payments";
import type { DemoState } from "@/server/use-cases/personas";
import type {
  AccountDeletion,
  ConsentKind,
  exportMyData,
  MyProfile,
  ProfileCorrection,
} from "@/server/use-cases/profile";
import type { NewRating, RatingSubmitted } from "@/server/use-cases/ratings";
import type { ProfileCreated } from "@/server/use-cases/registration";
import type { ReportCreated, ReportKind } from "@/server/use-cases/reports";

import type { ApiRequest } from "./api";

export type {
  AccountDeletion,
  ConsentKind,
  ContractDetail,
  DemoState,
  LevelStatus,
  MyProfile,
  MyRoute,
  ProfileCorrection,
  WorkerOffer,
};
export type WorkerPersona = DemoState["personas"]["workers"][number];
export type MyData = Awaited<ReturnType<typeof exportMyData>>;
export type WorkerRatingInput = NewRating;

export interface AttendanceInput {
  readonly contractId: string;

  readonly position?: GeoPoint;

  readonly simulated?: boolean;
}

export interface WorkerSignupInput {
  readonly name: string;
  readonly isAdult: true;
  readonly trade: string;
  readonly yearsExp: number;
  readonly skills: readonly string[];
  readonly zone: string;
  readonly availability: string;
  readonly consent: true;
}

export interface VoiceSession {
  readonly token: string;
  readonly dynamicVariables: Readonly<Record<string, string>>;
}

export type { ProfileCreated };

export interface ReportInput {
  readonly kind: ReportKind;
  readonly text: string;
}

const AS_WORKER = { as: "worker" } as const;
const segment = (id: string) => encodeURIComponent(id);

export function createWorkerApi(request: ApiRequest) {
  const get = <T>(path: string, signal?: AbortSignal) =>
    request<T>(path, signal ? { ...AS_WORKER, signal } : AS_WORKER);
  const send = <T>(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown) =>
    request<T>(path, { ...AS_WORKER, method, body });
  const post = <T>(path: string, body?: unknown) => send<T>("POST", path, body);

  return {
    state: (signal?: AbortSignal) => get<DemoState>("/api/state", signal),
    enter: (workerId: string) => post<DemoState>("/api/state", { role: "worker", id: workerId }),
    register: (input: WorkerSignupInput) => post<{ profile: ProfileCreated }>("/api/workers/register", input),

    registrationVoice: () => get<VoiceSession>("/api/el/token?agent=worker&registro=1&real=1&consent=1"),
    voice: () => get<VoiceSession>("/api/el/token?agent=worker"),

    claimProfile: (conversationId: string) =>
      get<{ profile: ProfileCreated }>(`/api/workers/by-conversation/${segment(conversationId)}`),

    offers: async (signal?: AbortSignal) =>
      (await get<{ offers: WorkerOffer[] }>("/api/invitations", signal)).offers,
    respond: (invitationId: string, accept: boolean) =>
      post<InvitationResponse>(`/api/invitations/${segment(invitationId)}/respond`, { accept }),

    contract: (contractId: string, signal?: AbortSignal) =>
      get<ContractDetail>(`/api/contracts/${segment(contractId)}`, signal),
    requestOtp: (contractId: string) => post<{ otp: string }>(`/api/contracts/${segment(contractId)}/otp`),
    sign: (contractId: string, otp: string) =>
      post<PublicContract>(`/api/contracts/${segment(contractId)}/sign`, { otp }),

    checkIn: (input: AttendanceInput) => post<AttendanceRow>("/api/attendance/checkin", input),
    checkOut: (input: AttendanceInput) => post<AttendanceRow>("/api/attendance/checkout", input),

    confirmPayment: (paymentId: string) => post<PaymentRow>(`/api/payments/${segment(paymentId)}/confirm`),
    rate: (input: WorkerRatingInput) => post<RatingSubmitted>("/api/ratings", input),

    level: (signal?: AbortSignal) => get<LevelStatus>("/api/level", signal),
    recalculateLevel: () => post<LevelStatus>("/api/level/recalc"),

    profile: (signal?: AbortSignal) => get<MyProfile>("/api/me", signal),
    correctProfile: (changes: ProfileCorrection) => send<MyProfile>("PATCH", "/api/me", changes),
    setConsent: async (kind: ConsentKind, granted: boolean) =>
      (await post<{ consents: MyProfile["consents"] }>("/api/me/consents", { kind, granted })).consents,
    myData: (signal?: AbortSignal) => get<MyData>("/api/me/data", signal),
    deleteAccount: () => send<AccountDeletion>("DELETE", "/api/me"),

    route: (signal?: AbortSignal) => get<MyRoute>("/api/courses", signal),
    enroll: (courseId: string) => post<unknown>(`/api/courses/${segment(courseId)}/enroll`),
    recordProgress: (enrollmentId: string, progress: number) =>
      post<unknown>(`/api/enrollments/${segment(enrollmentId)}/progress`, { progress }),
    bookPracticalTest: () => post<unknown>("/api/practical-tests"),

    report: (input: ReportInput) => post<ReportCreated>("/api/reports", input),
  };
}

export type WorkerApi = ReturnType<typeof createWorkerApi>;
