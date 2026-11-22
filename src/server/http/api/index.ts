import type { RuntimeProvider } from "../endpoint";
import { levelRoutes, paymentRoutes, ratingRoutes } from "./closing";
import { requestRoutes } from "./requests";
import { stateRoutes } from "./state";
import { demoRoutes, eventRoutes, reportRoutes } from "./team";
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
});

export type Api = ReturnType<typeof createApi>;
