import type { Metadata } from "next";
import { Suspense } from "react";

import { WorkerGate } from "@/components/worker/worker-gate";

export const metadata: Metadata = { title: { default: "Trabajador", template: "%s · Trabajador · NIVEL" } };

export default function WorkerLayout({ children }: LayoutProps<"/trabajador">) {
  // La puerta lee `?demo=1` de la dirección: por eso va dentro de un límite de suspensión.
  return (
    <Suspense>
      <WorkerGate>{children}</WorkerGate>
    </Suspense>
  );
}
