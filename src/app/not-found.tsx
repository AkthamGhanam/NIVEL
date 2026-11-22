import type { Metadata } from "next";

import { DemoFooter, NivelMark } from "@/components/brand/brand";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "No encontramos esa página" };

export default function NotFound() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center gap-5 px-4 py-16">
        <NivelMark />
        <h1 className="display text-4xl">No encontramos esa página</h1>
        <p className="text-lg text-ink-2">
          Puede que el enlace esté incompleto o que la página ya no exista.
        </p>
        <ButtonLink href="/">Volver al inicio</ButtonLink>
      </main>
      <DemoFooter />
    </>
  );
}
