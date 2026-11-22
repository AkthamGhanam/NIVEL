import type { Metadata } from "next";

import { CompanyGate } from "@/components/company/company-gate";

export const metadata: Metadata = { title: { default: "Contratista", template: "%s · Contratista · NIVEL" } };

export default function CompanyLayout({ children }: LayoutProps<"/contratista">) {
  return <CompanyGate>{children}</CompanyGate>;
}
