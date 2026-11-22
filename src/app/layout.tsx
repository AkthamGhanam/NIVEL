import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { connection } from "next/server";

import "./globals.css";

/** Inter servida desde nuestro propio dominio: sin peticiones a terceros y compatible con la CSP. */
const inter = localFont({
  variable: "--font-inter",
  display: "swap",
  src: [
    { path: "./fonts/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/inter-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/inter-latin-800-normal.woff2", weight: "800", style: "normal" },
    { path: "./fonts/inter-latin-900-normal.woff2", weight: "900", style: "normal" },
    { path: "./fonts/inter-latin-800-italic.woff2", weight: "800", style: "italic" },
    { path: "./fonts/inter-latin-900-italic.woff2", weight: "900", style: "italic" },
  ],
});

export const metadata: Metadata = {
  title: { default: "NIVEL · por Bytes Technology", template: "%s · NIVEL" },
  description: "Capacítate. Trabaja. Sube de nivel. Contrata rápido y en regla.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#19510A",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Toda página se renderiza por petición: así cada respuesta lleva su nonce de CSP.
  await connection();
  return (
    <html lang="es-VE" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
