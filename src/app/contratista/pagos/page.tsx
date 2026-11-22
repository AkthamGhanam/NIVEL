import type { Metadata } from "next";

import { PaymentsScreen } from "@/components/company/payments-screen";

export const metadata: Metadata = { title: "Pagos" };

export default function CompanyPaymentsPage() {
  return <PaymentsScreen />;
}
