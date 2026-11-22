import type { Metadata } from "next";

import { MetricsScreen } from "@/components/admin/metrics-screen";

export const metadata: Metadata = { title: "Métricas" };

export default function AdminMetricsPage() {
  return <MetricsScreen />;
}
