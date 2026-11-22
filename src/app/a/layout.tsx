import type { Metadata } from "next";

import { AcademyGate } from "@/components/academy/academy-gate";

export const metadata: Metadata = { title: { default: "Academia", template: "%s · Academia · NIVEL" } };

export default function AcademyLayout({ children }: LayoutProps<"/a">) {
  return <AcademyGate>{children}</AcademyGate>;
}
