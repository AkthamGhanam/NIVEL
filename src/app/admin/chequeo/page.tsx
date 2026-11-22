import type { Metadata } from "next";

import { PreflightScreen } from "@/components/admin/preflight-screen";

export const metadata: Metadata = { title: "Chequeo previo" };

export default function PreflightPage() {
  return <PreflightScreen />;
}
