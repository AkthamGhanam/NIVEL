import type { Metadata } from "next";

import { RequestScreen } from "@/components/company/request-screen";

export const metadata: Metadata = { title: "Pedir cuadrilla" };

export default function CompanyRequestPage() {
  return <RequestScreen />;
}
