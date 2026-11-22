import type { Metadata } from "next";

import { OfferScreen } from "@/components/worker/offer-screen";

export const metadata: Metadata = { title: "Oferta" };

export default async function WorkerOfferPage({ params }: PageProps<"/trabajador/oferta/[id]">) {
  const { id } = await params;
  return <OfferScreen invitationId={id} />;
}
