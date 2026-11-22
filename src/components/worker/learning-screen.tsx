"use client";

import { useState } from "react";

import { errorMessage } from "@/client/api";
import { createLiveStore } from "@/client/live-store";
import type { MyRoute } from "@/client/worker-api";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { LoadingText, Notice } from "@/components/ui/notice";
import { Progress } from "@/components/ui/progress";
import { Tag } from "@/components/ui/tag";
import { formatDay, formatDuration, formatRate, formatUsd, plural } from "@/lib/format";

import { useAction } from "../hooks/use-action";
import { useLive } from "../hooks/use-live";
import { useWorker } from "./worker-gate";

type Course = MyRoute["courses"][number];

export interface LearningActions {
  readonly onEnroll: (courseId: string) => void;
  /** Avance del curso, de 0 a 1, cuando la persona termina una lección. */
  readonly onProgress: (enrollmentId: string, progress: number) => void;
  readonly onBookTest: () => void;
  readonly pending: boolean;
}

function CoursePrice({ course }: { readonly course: Course }) {
  if (course.free || !course.price) return <Tag tone="ok">Gratis</Tag>;
  return (
    <div className="text-[0.9375rem]">
      <p className="font-bold">
        {formatUsd(course.price.base)} + IVA 16 % ({formatUsd(course.price.iva)}) ={" "}
        {formatUsd(course.price.total)}
      </p>
      {course.installments ? (
        <p className="text-muted">
          La academia ofrece {course.installments.count} cuotas de {formatUsd(course.installments.amountUsd)}.
          Le pagas directo a la academia.
        </p>
      ) : null}
    </div>
  );
}

function Lessons({ course, actions }: { readonly course: Course; readonly actions: LearningActions }) {
  const { enrollment, lessons } = course;
  if (!enrollment) return null;
  const heard = Math.round(enrollment.progress * lessons.length);
  return (
    <ol className="flex flex-col divide-y divide-line-2">
      {lessons.map((lesson, index) => (
        <li key={lesson.id} className="flex flex-col gap-2 py-2.5">
          <p className="font-semibold">
            {lesson.order}. {lesson.title}{" "}
            <span className="font-normal text-muted">· {formatDuration(lesson.durationS)}</span>
          </p>
          {lesson.audioUrl ? (
            <audio controls preload="none" src={lesson.audioUrl} className="w-full" />
          ) : null}
          {index < heard ? (
            <Tag tone="ok" className="self-start">
              Escuchada
            </Tag>
          ) : null}
          {index === heard ? (
            <Button
              variant="outline"
              disabled={actions.pending}
              onClick={() => actions.onProgress(enrollment.id, (index + 1) / lessons.length)}
            >
              Ya la escuché<span className="sr-only">: lección {lesson.order}</span>
            </Button>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function CourseCard({
  course,
  actions,
}: {
  readonly course: Course;
  readonly actions: LearningActions;
}) {
  const { enrollment } = course;
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <Eyebrow>{course.academy}</Eyebrow>
        <h3 className="mt-1 text-lg font-extrabold">{course.title}</h3>
        <p className="text-sm text-muted">
          {plural(course.weeks, "semana", "semanas")} · {course.mode}
        </p>
      </div>
      <CoursePrice course={course} />
      {course.constancia ? <Tag tone="ok">Constancia {course.constancia}</Tag> : null}
      {enrollment ? (
        <div>
          <p className="mb-1 text-sm font-semibold text-ink-2">Avance: {formatRate(enrollment.progress)}</p>
          <Progress value={enrollment.progress} label={`Avance de ${course.title}`} />
        </div>
      ) : (
        <Button block disabled={actions.pending} onClick={() => actions.onEnroll(course.id)}>
          {course.free ? "Empezar gratis" : "Inscribirme"}
          <span className="sr-only">: {course.title}</span>
        </Button>
      )}
      <Lessons course={course} actions={actions} />
    </Card>
  );
}

export function PracticalTestCard({
  test,
  actions,
}: {
  readonly test: MyRoute["practicalTest"];
  readonly actions: LearningActions;
}) {
  return (
    <Card className="flex flex-col gap-2">
      <Eyebrow>Prueba práctica</Eyebrow>
      <p className="text-ink-2">
        Una persona experta evalúa tu trabajo en {test.workshop}. Aprobarla sube tu nivel.
      </p>
      {test.passed ? <Tag tone="ok">Prueba práctica aprobada</Tag> : null}
      {!test.passed && test.scheduledFor ? (
        <Tag tone="pending">Agendada para el {formatDay(test.scheduledFor)}</Tag>
      ) : null}
      {!test.passed && !test.scheduledFor ? (
        <Button block disabled={actions.pending} onClick={actions.onBookTest}>
          Agendar mi prueba práctica
        </Button>
      ) : null}
    </Card>
  );
}

/** Mi ruta: cursos del oficio, lecciones y prueba práctica. */
export function LearningView({
  route,
  actions,
}: {
  readonly route: MyRoute;
  readonly actions: LearningActions;
}) {
  return (
    <>
      <PracticalTestCard test={route.practicalTest} actions={actions} />
      <section aria-labelledby="cursos-titulo" className="flex flex-col gap-3">
        <h2 id="cursos-titulo" className="bar-title text-xl font-extrabold">
          Cursos para ti
        </h2>
        {route.courses.length === 0 ? <p className="text-muted">Aún no hay cursos para tu oficio.</p> : null}
        <ul className="flex flex-col gap-3">
          {route.courses.map((course) => (
            <li key={course.id}>
              <CourseCard course={course} actions={actions} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export function LearningScreen() {
  const { api, profile } = useWorker();
  const [store] = useState(() => createLiveStore((signal) => api.route(signal)));
  const live = useLive(store);
  const act = useAction(async (work: () => Promise<unknown>) => {
    await work();
    await Promise.all([store.refresh(), profile.refresh()]);
  });
  const actions: LearningActions = {
    onEnroll: (courseId) => void act.invoke(() => api.enroll(courseId)),
    onProgress: (enrollmentId, progress) => void act.invoke(() => api.recordProgress(enrollmentId, progress)),
    onBookTest: () => void act.invoke(() => api.bookPracticalTest()),
    pending: act.pending,
  };
  return (
    <>
      <h1 className="display text-3xl">Mi ruta</h1>
      {live.loading ? <LoadingText>Nivi está armando tu ruta…</LoadingText> : null}
      {act.error ? (
        <Notice tone="alert" urgent>
          {act.error}
        </Notice>
      ) : null}
      {!live.loading && !live.data ? <Notice tone="alert">{errorMessage(live.error)}</Notice> : null}
      {live.data ? <LearningView route={live.data} actions={actions} /> : null}
    </>
  );
}
