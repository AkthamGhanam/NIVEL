import type { Metadata } from "next";

import { ContractScreen } from "@/components/worker/contract-screen";

export const metadata: Metadata = { title: "Contrato" };

export default async function WorkerContractPage({ params }: PageProps<"/t/contrato/[id]">) {
  const { id } = await params;
  return <ContractScreen contractId={id} />;
}
