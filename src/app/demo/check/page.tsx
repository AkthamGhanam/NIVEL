import type { Metadata } from "next";

import { PreflightScreen } from "@/components/demo/preflight-screen";
import { TeamGate } from "@/components/team/team-gate";

export const metadata: Metadata = { title: "Chequeo previo" };

export default function PreflightPage() {
  return (
    <TeamGate title="Chequeo previo">
      <PreflightScreen />
    </TeamGate>
  );
}
