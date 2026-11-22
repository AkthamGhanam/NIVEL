import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { TeamGate } from "@/components/team/team-gate";

export const metadata: Metadata = {
  title: { default: "Administración", template: "%s · Administración · NIVEL" },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <TeamGate title="Administración">
      <AdminShell>{children}</AdminShell>
    </TeamGate>
  );
}
