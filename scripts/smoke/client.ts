/**
 * Cliente mínimo de la API de NIVEL para el smoke: guarda una cookie de sesión
 * por rol, igual que el navegador del Modo Jurado, y habla JSON.
 * El transporte se inyecta: `fetch` contra un servidor real, o las rutas
 * importadas en proceso dentro de las pruebas.
 */

export type Transport = (request: Request) => Promise<Response>;

export type SmokeRole = "worker" | "company" | "academy" | "admin";

export interface CallOptions {
  /** Persona con la que se hace la petición. */
  readonly as?: SmokeRole;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface ApiResult<T = unknown> {
  readonly status: number;
  readonly data: T;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class ApiClient {
  private readonly cookies = new Map<string, string>();

  constructor(
    private readonly baseUrl: string,
    private readonly transport: Transport,
    private readonly demoKey: string | undefined,
  ) {}

  /** Entra como un personaje del seed y guarda su cookie. */
  async enterAs(role: Exclude<SmokeRole, "admin">, id: string): Promise<void> {
    await this.post("/api/state", { body: { role, id } });
  }

  get<T = unknown>(path: string, options: CallOptions = {}): Promise<T> {
    return this.expectOk<T>("GET", path, options);
  }

  post<T = unknown>(path: string, options: CallOptions = {}): Promise<T> {
    return this.expectOk<T>("POST", path, options);
  }

  /** Petición sin interpretar el resultado: para comprobar rechazos. */
  async call<T = unknown>(method: string, path: string, options: CallOptions = {}): Promise<ApiResult<T>> {
    const headers = new Headers(options.headers);
    if (this.cookies.size > 0) {
      headers.set("cookie", [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; "));
    }
    if (options.as === "admin" && this.demoKey) headers.set("x-demo-key", this.demoKey);
    else if (options.as) headers.set("x-nivel-role", options.as);
    const hasBody = method !== "GET" && method !== "HEAD";
    if (hasBody) headers.set("content-type", "application/json");
    const response = await this.transport(
      new Request(new URL(path, this.baseUrl), {
        method,
        headers,
        body: hasBody ? JSON.stringify(options.body ?? {}) : null,
      }),
    );
    this.rememberCookies(response);
    const text = await response.text();
    return { status: response.status, data: (text ? JSON.parse(text) : null) as T };
  }

  private async expectOk<T>(method: string, path: string, options: CallOptions): Promise<T> {
    const { status, data } = await this.call<T>(method, path, options);
    if (status >= 200 && status < 300) return data;
    const error = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(
      status,
      error?.code ?? "desconocido",
      `${method} ${path} → ${status} ${error?.message ?? ""}`,
    );
  }

  private rememberCookies(response: Response): void {
    for (const cookie of response.headers.getSetCookie()) {
      const [pair = ""] = cookie.split(";");
      const separator = pair.indexOf("=");
      if (separator > 0) this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }
}
