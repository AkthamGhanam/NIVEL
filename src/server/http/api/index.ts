// Todas las rutas de la API, listas para montarse en src/app/api.
import type { RuntimeProvider } from "../endpoint";
import { feeRoutes, metricRoutes } from "./business";
import { levelRoutes, paymentRoutes, ratingRoutes } from "./closing";
import { academyRoutes, learningRoutes } from "./learning";
import { meRoutes } from "./me";
import { requestRoutes } from "./requests";
import { signupRoutes } from "./signup";
import { stateRoutes } from "./state";
import { telegramRoutes } from "./telegram";
import { demoRoutes, eventRoutes, reportRoutes, voiceSetupRoutes } from "./team";
import { companyTools, crewTools, offerTools, workerTools } from "./tools";
import { voiceRoutes } from "./voice";
import { attendanceRoutes, contractRoutes, invitationRoutes } from "./work";

export const createApi = (runtime: RuntimeProvider) => ({
  state: stateRoutes(runtime),
  signup: signupRoutes(runtime),
  requests: requestRoutes(runtime),
  invitations: invitationRoutes(runtime),
  contracts: contractRoutes(runtime),
  attendance: attendanceRoutes(runtime),
  payments: paymentRoutes(runtime),
  ratings: ratingRoutes(runtime),
  level: levelRoutes(runtime),
  reports: reportRoutes(runtime),
  events: eventRoutes(runtime),
  demo: demoRoutes(runtime),
  voiceSetup: voiceSetupRoutes(runtime),
  voice: voiceRoutes(runtime),
  me: meRoutes(runtime),
  learning: learningRoutes(runtime),
  academy: academyRoutes(runtime),
  fees: feeRoutes(runtime),
  metrics: metricRoutes(runtime),
  telegram: telegramRoutes(runtime),
  tools: {
    ...workerTools(runtime),
    ...offerTools(runtime),
    ...companyTools(runtime),
    ...crewTools(runtime),
  },
});

export type Api = ReturnType<typeof createApi>;
