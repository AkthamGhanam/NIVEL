import type { Metadata } from "next";

import { isRealVisitor } from "@/client/registration-view";
import { RegistrationScreen } from "@/components/registration/registration-screen";

export const metadata: Metadata = { title: "Registro" };

export default async function WorkerRegistrationPage({ searchParams }: PageProps<"/t/registro">) {
  const { real } = await searchParams;
  return <RegistrationScreen real={isRealVisitor(real)} />;
}
