import { Suspense } from "react";

import { WorkerGate } from "@/components/worker/worker-gate";

export default function WorkerAppLayout({ children }: LayoutProps<"/t">) {
  // La puerta lee `?demo=1` de la dirección: por eso va dentro de un límite de suspensión.
  return (
    <Suspense>
      <WorkerGate>{children}</WorkerGate>
    </Suspense>
  );
}
