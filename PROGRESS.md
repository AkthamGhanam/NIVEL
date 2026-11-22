# Progreso de NIVEL

Plan aprobado: https://claude.ai/artifact/GSnQHsdYHduT8bpe6sQPD2 (backend fases 0–5, frontend 6–10).

## Fase 0 · Cimientos — en curso

- [x] Next.js 16.4.6 + TypeScript estricto (`noUncheckedIndexedAccess`, `noImplicitReturns`)
- [x] ESLint sin avisos, Prettier, Vitest con umbral de cobertura
- [x] Cabeceras de seguridad y CSP con nonce, verificadas en `next start` con Chromium (0 errores de consola)
- [x] Entorno validado con zod (`src/server/config/env.ts`)
- [x] `GET /api/health`
- [x] CI de GitHub Actions y Dependabot
- [x] CI en verde en GitHub (AkthamGhanam/NIVEL, run 44996534113)
- [ ] Despliegue en Vercel con `/api/health` en 200

## Fase 1 · Dominio puro — lista

- [x] `level` + `level-explanation`: tabla pública, freno de calificaciones que nunca baja el nivel
- [x] `pricing` (IVA 16 % aparte, centavos enteros) y `legal-cost` (25 $ × 5 días = 196,67)
- [x] `matching`: 6 candidatos del camino dorado en orden Rafael, José, Luis, Carlos; perfil sin datos sensibles
- [x] `moderation`: 13 frases bloqueadas y 9 legítimas permitidas (incluye "mayor de 18")
- [x] `geo` (geocerca 120 m) y `dates` ("el martes" en hora de Caracas)
- [x] 154 pruebas; cobertura 100 % de líneas en `src/lib`

## Fase 2 · Datos — lista

- [x] Esquema Drizzle de 19 tablas; el DDL se genera desde el esquema (`ddl.ts`) con CHECK en cada enum
- [x] Seed canónico: 40 trabajadores, 6 soldadores cumplen el pedido del guion, niveles respaldados por hechos
- [x] `resetDemo`: una transacción, idempotente (misma huella sha256 tras dos resets), conserva `is_real`
- [x] `npm run db:seed` crea la base local (717 filas en ~70 ms)

Cambios respecto a la sección 5.1 de la especificación, todos por seguridad o consistencia:

- `contracts.otp_hash` en lugar de `otp_code`: el código de firma no se guarda en claro.
- `contracts.start_date`: la disponibilidad se deduce de contratos activos, no de un texto libre.
- `fees.academy_id`, `fees.contract_id`, `fees.created_at`: para calcular ingresos sin adivinar por el concepto.
- `workers.conversation_id`: enlaza el registro por voz con la pantalla que lo inició.
- Sin `drizzle-kit`: arrastra un `esbuild` con aviso de seguridad; las tablas se crean desde el propio esquema.

## Fase 3 · Casos de uso y API del camino dorado — lista

- [x] Casos de uso con permisos por actor: solicitud, invitación, contrato y firma, asistencia con geocerca,
      pago y recibo, calificación doble ciega, nivel, reportes con revisión humana, controles del Modo Jurado
- [x] 23 rutas en `src/app/api`, cada una de una línea; la validación zod vive en `src/server/http/api`
- [x] Sesión por cookie firmada, una por vista (`nivel_worker`, `nivel_company`, `nivel_academy`, `nivel_admin`)
- [x] `npm run smoke`: 17 pasos del camino dorado; Carlos termina en Nivel 3
- [x] El mismo smoke corre en las pruebas contra los archivos de ruta reales, y en CI contra `next start`
- [x] 254 pruebas; cobertura de líneas 98 %

Cambios respecto a la sección 9 de la especificación, todos por seguridad:

- `GET /api/invitations`, `GET /api/level` y `POST /api/level/recalc` no reciben `workerId`: usan la sesión.
- `POST /api/contracts` no existe: el contrato nace cuando el trabajador acepta la invitación.
- `GET /api/events` y `GET /api/reports` exigen sesión de equipo o `x-demo-key`.
- `contracts.otp_attempts`: el código de firma se bloquea tras 5 intentos.

## Fase 4 · Herramientas de los agentes de voz — lista (sin probar aún con ElevenLabs real)

- [x] Las 7 herramientas en `/api/tools/*` con `x-tool-secret`; cada una responde `say`, la frase que Nivi lee
- [x] Registro por voz: perfil en Nivel 1, solo mayores de 18, con el permiso aceptado en pantalla
- [x] `GET /api/el/token`: token de conversación (8 s de espera, 1 reintento) más el contexto firmado
- [x] `GET /api/workers/by-conversation/:id`: la pantalla que habló recoge su perfil y su sesión
- [x] Bot de demo (`POST /api/demo/bot`): Rafael y José aceptan a los 3 s, Luis rechaza a los 6 s, nunca Carlos
- [x] Límite de peticiones por IP: general, por token de voz y bloqueo tras 10 secretos errados
- [x] Un perfil real no entra a las búsquedas hasta que la persona acepta compartirlo
- [x] Agentes como código en `src/server/agents/definitions.ts` (prompts y herramientas)
- [x] 310 pruebas; cobertura de líneas 98 %

Cambios respecto a la sección 7 de la especificación, todos por seguridad:

- Las herramientas no aceptan `worker_id` ni `company_id` del modelo. En nombre de quién actúan sale de un
  contexto que firma el servidor y viaja como variable secreta del agente (`secret__nivel_contexto`) en la
  cabecera `x-nivel-context`. Nadie puede hacerse pasar por otra persona hablando con Nivi.
- No hay `POST /api/events` para transcripciones: la bitácora registra cada herramienta con su latencia,
  sin nombres ni lo que se dijo.
- El código de firma nunca se dice en voz alta: solo aparece en la pantalla del trabajador.
- El bot no usa temporizadores (no sobreviven en serverless): avanza cuando la empresa consulta su tablero.

Sin probar todavía: la conversación real con ElevenLabs. Falta la clave para publicar los agentes y
confirmar que la plataforma envía la variable secreta en la cabecera como dice su documentación.
El límite de peticiones es por instancia: frena abusos, pero no es un contador global exacto.

## Decisiones

- **Sin Cache Components.** La CSP con nonce exige renderizar cada página por petición, y la demo es en vivo.
- **Kit v2.** Sin WhatsApp ni telefonía: toda la voz dentro de la app (`NiviVoice`), widget oficial como plan C.

## HUMANO

- HUMANO: crear el proyecto en Vercel conectado a ese repositorio.
- HUMANO: confirmar créditos de ElevenLabs (Agents, TTS, STT, Sound Effects).
- HUMANO: crear la base en Turso y poner en Vercel `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `SESSION_SECRET`,
  `DEMO_RESET_KEY`, `TOOL_SECRET` y `NEXT_PUBLIC_APP_URL` (ver `.env.example`).
- HUMANO: poner `ELEVENLABS_API_KEY` en Vercel y en el entorno de trabajo para publicar los agentes (fase 5).
