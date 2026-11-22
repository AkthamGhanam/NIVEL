import type { Metadata } from "next";

import { InvoiceScreen } from "@/components/invoice/invoice-screen";

export const metadata: Metadata = { title: "Factura digital" };

export default async function InvoicePage({ params }: PageProps<"/factura/[id]">) {
  const { id } = await params;
  return <InvoiceScreen feeId={id} />;
}
