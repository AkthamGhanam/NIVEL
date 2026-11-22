import { z } from "zod";

import { evaluatePracticalTest, getAcademyPanel, issueConstancia } from "../../use-cases/academy";
import { bookPracticalTest, enrollInCourse, getMyRoute, recordProgress } from "../../use-cases/learning";
import { endpoint, type RuntimeProvider } from "../endpoint";
import { emptyBody, pathId } from "./schemas";

const MAX_TEST_SCORE = 10;
const progressSchema = z.strictObject({ progress: z.number().min(0).max(1) });
const scoreSchema = z.strictObject({ score: z.int().min(0).max(MAX_TEST_SCORE) });

/** "Mi ruta" del trabajador: cursos, lecciones y prueba práctica. */
export const learningRoutes = (runtime: RuntimeProvider) => ({
  route: endpoint({ access: "worker" }, ({ actor, context }) => getMyRoute(context, actor), runtime),

  enroll: endpoint(
    { access: "worker", body: emptyBody },
    ({ actor, params, context }) => enrollInCourse(context, actor, pathId(params)),
    runtime,
  ),

  progress: endpoint(
    { access: "worker", body: progressSchema },
    ({ actor, body, params, context }) =>
      recordProgress(context, actor, { enrollmentId: pathId(params), progress: body.progress }),
    runtime,
  ),

  bookTest: endpoint(
    { access: "worker", body: emptyBody },
    ({ actor, context }) => bookPracticalTest(context, actor),
    runtime,
  ),
});

/** Panel de la academia. Evaluar una prueba o emitir una constancia actualiza el nivel del trabajador. */
export const academyRoutes = (runtime: RuntimeProvider) => ({
  panel: endpoint({ access: "academy" }, ({ actor, context }) => getAcademyPanel(context, actor), runtime),

  evaluate: endpoint(
    { access: "academy", body: scoreSchema },
    ({ actor, body, params, context }) =>
      evaluatePracticalTest(context, actor, { testId: pathId(params), score: body.score }),
    runtime,
  ),

  constancia: endpoint(
    { access: "academy", body: emptyBody },
    ({ actor, params, context }) => issueConstancia(context, actor, pathId(params)),
    runtime,
  ),
});
