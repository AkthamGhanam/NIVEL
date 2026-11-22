import type { Metadata } from "next";

import { DemoScreen } from "@/components/demo/demo-screen";
import { TeamGate } from "@/components/team/team-gate";
import { serverEnv } from "@/server/config/env";

export const metadata: Metadata = { title: "Modo Jurado" };

export default function DemoPage() {
  const appUrl = serverEnv().NEXT_PUBLIC_APP_URL;
  // El QR lleva al público a la app del trabajador; sin dirección pública no se muestra.
  const joinUrl = appUrl ? new URL("/t", appUrl).toString() : null;
  return (
    <TeamGate title="Modo Jurado">
      <DemoScreen joinUrl={joinUrl} />
    </TeamGate>
  );
}
