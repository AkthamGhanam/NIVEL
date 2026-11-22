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

## Arquitectura

| Capa               | Carpeta                       | Regla                                         |
| ------------------ | ----------------------------- | --------------------------------------------- |
| Dominio puro       | `src/lib/`                    | Sin red, sin base de datos, 100 % probado     |
| Casos de uso       | `src/server/use-cases/`       | Orquestan el dominio a través de puertos      |
| Adaptadores        | `src/server/adapters/`        | Base de datos, ElevenLabs, almacenamiento     |
| Seguridad y config | `src/server/http`, `config`   | Cabeceras, CSP con nonce, entorno validado    |
| Entrada HTTP       | `src/app/api/`                | Validan con zod y delegan en los casos de uso |
| Interfaz           | `src/app/`, `src/components/` | `/t`, `/c`, `/a`, `/admin`, `/demo`           |

## Seguridad

- CSP estricta con nonce por petición en páginas (`src/proxy.ts`); la API responde con `default-src 'none'`.
- HSTS, `nosniff`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy` (micrófono y GPS solo para el propio sitio).
- Variables de entorno validadas con zod; los mensajes de error nunca muestran valores.
- CI: formato, lint, tipos, pruebas con cobertura, build, `npm audit` y `gitleaks`.

Demo · nombres, empresas y cifras de ejemplo.
