import type { Metadata } from "next";

import { CompanyGate } from "@/components/company/company-gate";

export const metadata: Metadata = { title: { default: "Contratista", template: "%s · Contratista · NIVEL" } };

export default function CompanyLayout({ children }: LayoutProps<"/c">) {
  return <CompanyGate>{children}</CompanyGate>;
}
