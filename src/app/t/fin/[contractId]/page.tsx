import type { Metadata } from "next";

import { FinishScreen } from "@/components/worker/finish-screen";

export const metadata: Metadata = { title: "Fin de obra" };

export default async function WorkerFinishPage({ params }: PageProps<"/t/fin/[contractId]">) {
  const { contractId } = await params;
  return <FinishScreen contractId={contractId} />;
}
