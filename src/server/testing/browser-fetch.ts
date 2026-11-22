import { dispatch } from "./in-process-api";

/**
 * Un `fetch` que se comporta como el navegador frente a nuestra API: guarda
 * las cookies que el servidor entrega, las devuelve en cada petición y manda
 * la cabecera `Origin` en las escrituras. Despacha a los archivos de ruta
 * reales, así las pruebas del cliente recorren el mismo camino que la pantalla.
 */
export function createBrowserFetch(baseUrl: string): typeof fetch {
  const cookies = new Map<string, string>();

  const remember = (response: Response) => {
    for (const cookie of response.headers.getSetCookie()) {
      const [pair = ""] = cookie.split(";");
      const separator = pair.indexOf("=");
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (value === "") cookies.delete(name);
      else cookies.set(name, value);
    }
  };

  return async (input, init = {}) => {
    const headers = new Headers(init.headers);
    if (cookies.size > 0) {
      headers.set("cookie", [...cookies].map(([name, value]) => `${name}=${value}`).join("; "));
    }
    const method = init.method ?? "GET";
    if (method !== "GET") headers.set("origin", baseUrl);
    headers.set("host", new URL(baseUrl).host);
    const request = new Request(new URL(String(input), baseUrl), {
      method,
      headers,
      body: method === "GET" ? null : (init.body ?? null),
      signal: init.signal ?? null,
    });
    const response = await dispatch(request);
    remember(response);
    return response;
  };
}
