import type { Metadata } from "next";

import { isReportKind } from "@/client/report-kinds";
import { HelpScreen } from "@/components/worker/help-screen";

export const metadata: Metadata = { title: "Ayuda" };

export default async function WorkerHelpPage({ searchParams }: PageProps<"/t/ayuda">) {
  const { tipo } = await searchParams;
  // Solo se acepta un tipo de la lista cerrada; cualquier otra cosa abre el formulario en "Otro problema".
  const kind = isReportKind(tipo) ? tipo : "otro";
  return <HelpScreen initialKind={kind} />;
}
