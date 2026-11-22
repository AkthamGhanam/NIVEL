import type { Metadata } from "next";

import { isPlanB } from "@/client/plan-b";
import { RequestScreen } from "@/components/company/request-screen";

export const metadata: Metadata = { title: "Pedir cuadrilla" };

export default async function CompanyRequestPage({ searchParams }: PageProps<"/c">) {
  const { planb } = await searchParams;
  return <RequestScreen planB={isPlanB(planb)} />;
}
