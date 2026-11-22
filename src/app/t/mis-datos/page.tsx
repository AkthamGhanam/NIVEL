import type { Metadata } from "next";

import { MyDataScreen } from "@/components/worker/my-data-screen";

export const metadata: Metadata = { title: "Mis datos" };

export default function WorkerDataPage() {
  return <MyDataScreen />;
}
