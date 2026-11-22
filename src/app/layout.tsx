import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "NIVEL · por Bytes Technology",
  description: "Capacítate. Trabaja. Sube de nivel. Contrata rápido y en regla.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#19510A",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-VE" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
