import { z } from "zod";

import { fastForwardActiveRequest, resetDemoData } from "../../use-cases/demo";
import { listEventsSince } from "../../use-cases/events";
import { createReport, listReportsInReview, REPORT_KINDS, resolveReport } from "../../use-cases/reports";
import { endpoint, type RuntimeProvider } from "../endpoint";
import { emptyBody, idSchema, pathId } from "./schemas";

const reportSchema = z.strictObject({
  kind: z.enum(REPORT_KINDS),
  text: z.string().trim().min(1).max(2000),
  companyId: idSchema.optional(),
});

const resolutionSchema = z.strictObject({
  outcome: z.enum(["resuelto", "descartado"]),
  note: z.string().trim().min(1).max(1000),
});

const fastForwardSchema = z.strictObject({ requestId: idSchema.optional() });
const sinceSchema = z.iso.datetime().optional();

export const reportRoutes = (runtime: RuntimeProvider) => ({
  create: endpoint(
    { access: "worker", body: reportSchema },
    ({ actor, body, context }) => createReport(context, actor, body),
    runtime,
  ),

  /** Cola de revisión humana: solo el equipo de NIVEL. */
  inReview: endpoint(
    { access: "admin" },
    async ({ actor, context }) => ({ reports: await listReportsInReview(context, actor) }),
    runtime,
  ),

  resolve: endpoint(
    { access: "admin", body: resolutionSchema },
    ({ actor, body, params, context }) =>
      resolveReport(context, actor, { reportId: pathId(params), ...body }),
    runtime,
  ),
});

export const eventRoutes = (runtime: RuntimeProvider) => ({
  /** Bitácora en vivo del Modo Jurado, a partir de `?since=` (ISO 8601). */
  list: endpoint(
    { access: "admin" },
    async ({ url, context }) => {
      const since = sinceSchema.parse(url.searchParams.get("since") ?? undefined);
      return { events: await listEventsSince(context, since) };
    },
    runtime,
  ),
});

export const demoRoutes = (runtime: RuntimeProvider) => ({
  /** Devuelve la demo al seed. Conserva los perfiles reales salvo con `?all=1`. */
  reset: endpoint(
    { access: "admin", body: emptyBody },
    ({ actor, url, context }) =>
      resetDemoData(context, actor, { keepRealWorkers: url.searchParams.get("all") !== "1" }),
    runtime,
  ),

  fastForward: endpoint(
    { access: "admin", body: fastForwardSchema },
    ({ actor, body, context }) => fastForwardActiveRequest(context, actor, body.requestId),
    runtime,
  ),
});
