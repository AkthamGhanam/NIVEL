import type { Metadata } from "next";

import { AcademyScreen } from "@/components/academy/academy-screen";

export const metadata: Metadata = { title: "Panel de la academia" };

export default function AcademyPage() {
  return <AcademyScreen />;
}
