# NIVEL · por Bytes Technology

> Capacítate. Trabaja. Sube de nivel. — Contrata rápido y en regla.

Demo para el Hackathon ValenValley 2026. Los trabajadores de oficios se registran hablando con Nivi
(agente de voz de ElevenLabs), suben de nivel con datos verificables y los contratistas arman su cuadrilla
por voz en minutos. NIVEL es la plataforma; el patrono siempre es el contratista.

La especificación completa está en [`docs/spec.md`](docs/spec.md) y el avance en [`PROGRESS.md`](PROGRESS.md).

## Requisitos

- Node.js 22 (ver `.nvmrc`)
- Copia `.env.example` a `.env.local` y rellena los valores. Las claves nunca se suben al repositorio.

## Comandos

| Comando                 | Qué hace                                         |
| ----------------------- | ------------------------------------------------ |
| `npm run dev`           | Servidor de desarrollo en http://localhost:3000  |
| `npm run check`         | Formato, lint, tipos y pruebas (lo mismo que CI) |
| `npm run test:coverage` | Pruebas con umbral de cobertura                  |
| `npm run build`         | Compilación de producción                        |
| `npm run db:seed`       | Crea las tablas y carga el seed en la base       |
| `npm run smoke`         | Camino dorado de 17 pasos contra un servidor     |

`npm run smoke` usa `SMOKE_BASE_URL` (por defecto `http://localhost:3000`) y la misma `DEMO_RESET_KEY`
del servidor. Reinicia la demo al empezar y al terminar; con `-- --keep` deja el estado final.

## Arquitectura

| Capa               | Carpeta                       | Regla                                         |
| ------------------ | ----------------------------- | --------------------------------------------- |
| Dominio puro       | `src/lib/`                    | Sin red, sin base de datos, 100 % probado     |
| Casos de uso       | `src/server/use-cases/`       | Reglas de negocio y permisos por actor        |
| Datos              | `src/server/db`, `repos`      | Esquema, seed, reset y lecturas agregadas     |
| Seguridad y config | `src/server/http`, `config`   | Sesión, CSRF, cabeceras, entorno validado     |
| Rutas de la API    | `src/server/http/api/`        | Validan con zod y delegan en los casos de uso |
| Entrada HTTP       | `src/app/api/`                | Una línea por ruta: monta el manejador        |
| Interfaz           | `src/app/`, `src/components/` | `/t`, `/c`, `/a`, `/admin`, `/demo`           |

## Seguridad

- CSP estricta con nonce por petición en páginas (`src/proxy.ts`); la API responde con `default-src 'none'`.
- HSTS, `nosniff`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy` (micrófono y GPS solo para el propio sitio).
- Variables de entorno validadas con zod; los mensajes de error nunca muestran valores.
- Quién hace cada petición se deduce en el servidor de una cookie firmada (HMAC, `HttpOnly`, `SameSite=Lax`),
  una por vista. Ningún id de persona se acepta del cliente y todo está denegado por defecto.
- Solo se puede entrar como un personaje de ejemplo: nunca como una persona real registrada en el evento.
- Las peticiones que cambian datos deben venir del propio origen (CSRF), en JSON y con menos de 64 KB.
- Los agentes de voz llaman a `/api/tools/*` con `x-tool-secret`. En nombre de quién actúan lo decide un
  contexto firmado por el servidor, no el modelo de lenguaje.
- Límite de peticiones por IP, con bloqueo temporal tras varios secretos errados.
- Un perfil real nace privado: no aparece en búsquedas hasta que la persona acepta compartirlo.
- "Mis datos": cada persona ve, descarga, corrige y borra lo suyo, y da o retira cada permiso por separado.
  La sesión deja de valer en cuanto la cuenta se borra.
- Cada empresa y academia ve y paga solo sus tarifas; una academia evalúa solo a sus alumnos o en su taller.
- El código de firma se guarda como HMAC, con 5 intentos; la bitácora no guarda reportes ni datos personales.
- Los errores inesperados responden un mensaje genérico con un `requestId`; el detalle queda en el log.
- CI: formato, lint, tipos, pruebas con cobertura, build, `npm audit` y `gitleaks`.

Demo · nombres, empresas y cifras de ejemplo.
