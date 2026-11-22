import type { Metadata } from "next";

import { isPlanB } from "@/client/plan-b";
import { DemoScreen } from "@/components/demo/demo-screen";
import { TeamGate } from "@/components/team/team-gate";
import { serverEnv } from "@/server/config/env";

export const metadata: Metadata = { title: "Modo Jurado" };

export default async function DemoPage({ searchParams }: PageProps<"/demo">) {
  const { planb } = await searchParams;
  const appUrl = serverEnv().NEXT_PUBLIC_APP_URL;
  // El QR lleva al público a la app del trabajador; sin dirección pública no se muestra.
  const joinUrl = appUrl ? new URL("/t/registro?real=1", appUrl).toString() : null;
  return (
    <TeamGate title="Modo Jurado">
      <DemoScreen joinUrl={joinUrl} planB={isPlanB(planb)} />
    </TeamGate>
  );
}
