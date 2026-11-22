import type { Metadata } from "next";

export const metadata: Metadata = { title: { default: "Trabajador", template: "%s · Trabajador · NIVEL" } };

/**
 * Todo `/t` comparte el título. La app con sesión vive en el grupo `(app)`,
 * detrás de su puerta; `/t/registro` queda fuera porque quien se registra aún
 * no tiene sesión.
 */
export default function WorkerRootLayout({ children }: LayoutProps<"/t">) {
  return children;
}
