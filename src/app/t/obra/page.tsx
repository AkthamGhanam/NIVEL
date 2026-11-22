import type { Metadata } from "next";

import { SiteScreen } from "@/components/worker/site-screen";

export const metadata: Metadata = { title: "Tu obra" };

export default function WorkerSitePage() {
  return <SiteScreen />;
}
