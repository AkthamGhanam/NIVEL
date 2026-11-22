// Página de /admin/datos.
import type { Metadata } from "next";

import { DataScreen } from "@/components/admin/data-screen";

export const metadata: Metadata = { title: "Datos de la demo" };

export default function AdminDataPage() {
  return <DataScreen />;
}
