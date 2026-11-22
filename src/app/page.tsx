import { connection } from "next/server";

const DEMO_FOOTER = "Demo · nombres, empresas y cifras de ejemplo";

/** Landing provisional de la fase 0. Dinámica para que cada respuesta lleve su nonce de CSP. */
export default async function HomePage() {
  await connection();
  return (
    <>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-4 py-16">
        <p className="text-xs font-bold tracking-widest text-brand uppercase">NIVEL · por Bytes Technology</p>
        <h1 className="text-4xl font-black italic tracking-tight">Capacítate. Trabaja. Sube de nivel.</h1>
        <p className="text-lg">Contrata rápido y en regla.</p>
      </main>
      <footer className="px-4 py-6 text-center text-sm text-muted">{DEMO_FOOTER}</footer>
    </>
  );
}
