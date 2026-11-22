// Rutas del equipo: reportes, bitácora, reinicio de la demo y voz.
import { z } from "zod";

import { fastForwardActiveRequest, resetDemoData, setDemoBot } from "../../use-cases/demo";
import { listEventsSince } from "../../use-cases/events";
import { createReport, listReportsInReview, REPORT_KINDS, resolveReport } from "../../use-cases/reports";
import { checkVoice, publishAgents } from "../../use-cases/voice-setup";
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

const botSchema = z.strictObject({ state: z.enum(["on", "off"]) });
const fastForwardSchema = z.strictObject({ requestId: idSchema.optional() });
const sinceSchema = z.iso.datetime().optional();

export const reportRoutes = (runtime: RuntimeProvider) => ({
  create: endpoint(
    { access: "worker", body: reportSchema },
    ({ actor, body, context }) => createReport(context, actor, body),
    runtime,
  ),

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
  reset: endpoint(
    { access: "admin", body: emptyBody },
    ({ actor, url, context }) =>
      resetDemoData(context, actor, { keepRealWorkers: url.searchParams.get("all") !== "1" }),
    runtime,
  ),

  bot: endpoint(
    { access: "admin", body: botSchema },
    ({ actor, body, context }) => setDemoBot(context, actor, body.state === "on"),
    runtime,
  ),

  fastForward: endpoint(
    { access: "admin", body: fastForwardSchema },
    ({ actor, body, context }) => fastForwardActiveRequest(context, actor, body.requestId),
    runtime,
  ),
});

export const voiceSetupRoutes = (runtime: RuntimeProvider) => ({
  publish: endpoint(
    { access: "admin", body: emptyBody },
    ({ services }) => publishAgents(services.voiceSetup()),
    runtime,
  ),

  check: endpoint(
    { access: "admin", body: emptyBody },
    ({ context, services, issueToolContext }) =>
      checkVoice(
        context,
        services.voiceSetup(),
        issueToolContext({ kind: "registration", real: false, consentAt: context.now().toISOString() }),
      ),
    runtime,
  ),
});
