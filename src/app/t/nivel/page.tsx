import type { Metadata } from "next";

import { LevelScreen } from "@/components/worker/level-screen";

export const metadata: Metadata = { title: "Mi nivel" };

export default async function WorkerLevelPage({ searchParams }: PageProps<"/t/nivel">) {
  const { subiste } = await searchParams;
  return <LevelScreen celebrate={subiste === "1"} />;
}
