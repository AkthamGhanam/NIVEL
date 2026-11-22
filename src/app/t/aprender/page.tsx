import type { Metadata } from "next";

import { LearningScreen } from "@/components/worker/learning-screen";

export const metadata: Metadata = { title: "Mi ruta" };

export default function WorkerLearningPage() {
  return <LearningScreen />;
}
