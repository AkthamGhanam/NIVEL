import type { NextConfig } from "next";

import { API_CONTENT_SECURITY_POLICY, BASE_SECURITY_HEADERS } from "./src/server/http/security-headers";

const toHeaderList = (headers: Readonly<Record<string, string>>) =>
  Object.entries(headers).map(([key, value]) => ({ key, value }));

const nextConfig: NextConfig = {
  // Sin Cache Components: la CSP con nonce exige renderizar cada página por petición,
  // y la demo es en vivo (polling), así que no hay nada útil que prerenderizar.
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Las apps se llamaban /t y /c: los enlaces y QR viejos siguen funcionando.
  async redirects() {
    return [
      { source: "/t/:path*", destination: "/trabajador/:path*", permanent: false },
      { source: "/c/:path*", destination: "/contratista/:path*", permanent: false },
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
