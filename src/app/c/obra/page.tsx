import type { Metadata } from "next";

import { SiteScreen } from "@/components/company/site-screen";

export const metadata: Metadata = { title: "Obra" };

export default function CompanySitePage() {
  return <SiteScreen />;
}
