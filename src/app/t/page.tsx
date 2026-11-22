import type { Metadata } from "next";

import { HomeScreen } from "@/components/worker/home-screen";

export const metadata: Metadata = { title: "Inicio" };

export default function WorkerHomePage() {
  return <HomeScreen />;
}
