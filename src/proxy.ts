import { type NextRequest, NextResponse } from "next/server";

import { buildPageContentSecurityPolicy, createNonce } from "@/server/http/security-headers";

/**
 * Genera un nonce por petición y aplica la CSP estricta a las páginas.
 * Next.js lee el nonce de la cabecera de la petición y lo pone en sus scripts.
 * La API y los estáticos reciben sus cabeceras desde `next.config.ts`.
 */
export function proxy(request: NextRequest): NextResponse {
  const contentSecurityPolicy = buildPageContentSecurityPolicy({
    nonce: createNonce(),
    isDevelopment: process.env.NODE_ENV === "development",
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|brand|audio|sfx).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
