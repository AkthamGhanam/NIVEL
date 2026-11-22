import type { RuntimeProvider } from "../endpoint";
import { feeRoutes, metricRoutes } from "./business";
import { levelRoutes, paymentRoutes, ratingRoutes } from "./closing";
import { academyRoutes, learningRoutes } from "./learning";
import { meRoutes } from "./me";
import { requestRoutes } from "./requests";
import { stateRoutes } from "./state";
import { demoRoutes, eventRoutes, reportRoutes } from "./team";
import { companyTools, crewTools, offerTools, workerTools } from "./tools";
import { voiceRoutes } from "./voice";
import { attendanceRoutes, contractRoutes, invitationRoutes } from "./work";

/**
 * Todas las rutas de la API, listas para montarse en `src/app/api`. Reciben el
 * runtime como dependencia: en producción el real, en las pruebas uno temporal.
 */
export const createApi = (runtime: RuntimeProvider) => ({
  state: stateRoutes(runtime),
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
  voice: voiceRoutes(runtime),
  me: meRoutes(runtime),
  learning: learningRoutes(runtime),
  academy: academyRoutes(runtime),
  fees: feeRoutes(runtime),
  metrics: metricRoutes(runtime),
  tools: {
    ...workerTools(runtime),
    ...offerTools(runtime),
    ...companyTools(runtime),
    ...crewTools(runtime),
  },
});

export type Api = ReturnType<typeof createApi>;
