// Configuración de Next.js: cabeceras de seguridad, redirecciones y Tailwind con Turbopack.
import type { NextConfig } from "next";

import { API_CONTENT_SECURITY_POLICY, BASE_SECURITY_HEADERS } from "./src/server/http/security-headers";

const toHeaderList = (headers: Readonly<Record<string, string>>) =>
  Object.entries(headers).map(([key, value]) => ({ key, value }));

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  async redirects() {
    return [
      { source: "/trabajador/:path*", destination: "/t/:path*", permanent: false },
      { source: "/contratista/:path*", destination: "/c/:path*", permanent: false },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: toHeaderList(BASE_SECURITY_HEADERS) },
      {
        source: "/api/:path*",
        headers: [
          { key: "Content-Security-Policy", value: API_CONTENT_SECURITY_POLICY },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
