import type { Metadata } from "next";

import { ReceiptScreen } from "@/components/receipt/receipt-screen";

export const metadata: Metadata = { title: "Recibo de pago" };

const VIEWS = { empresa: "company", trabajador: "worker" } as const;

export default async function ReceiptPage({ params, searchParams }: PageProps<"/recibo/[id]">) {
  const [{ id }, { vista }] = await Promise.all([params, searchParams]);
  const view = typeof vista === "string" && vista in VIEWS ? VIEWS[vista as keyof typeof VIEWS] : undefined;
  return <ReceiptScreen paymentId={id} view={view} />;
}
