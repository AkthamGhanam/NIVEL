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

## Fase 5a · Datos para las pantallas — lista

- [x] Migración que agrega columnas nuevas a una base ya creada sin perder datos (`ALTER TABLE ADD COLUMN`)
- [x] "Mis datos": `GET/PATCH/DELETE /api/me`, `POST /api/me/consents`, `GET /api/me/data` (descarga)
- [x] "Abierto a trabajar" y cada permiso por separado; retirar "compartir perfil" saca de las búsquedas al instante
- [x] Borrar la cuenta cierra la sesión; una cookie firmada deja de valer cuando la cuenta ya no existe
- [x] "Mi ruta": `GET /api/courses`, inscripción, avance de lecciones y prueba práctica agendada
- [x] Panel de academia: `GET /api/academy`, evaluar la prueba práctica y emitir la constancia (ambas recalculan el nivel)
- [x] Tarifas de NIVEL: `GET /api/fees`, `POST /api/fees/:id/pay` (solo Pago Móvil o transferencia), sugerencia del Plan Obra
- [x] `GET /api/metrics` y `GET /api/demo/real-profiles` (solo nombre de pila, oficio y zona)
- [x] El tablero de la empresa trae la última jornada de cada persona; la oferta trae "paga a tiempo" (dato objetivo)
- [x] Clasificador de reportes por texto, listo para la transcripción de voz
- [x] Varias personas aceptando a la vez: nadie recibe un error y la cuadrilla nunca se pasa del cupo
- [x] Una sola inscripción y una sola constancia por persona y curso, aunque lleguen dos toques a la vez
- [x] 370 pruebas; cobertura de líneas 99 %

Cambios respecto a la especificación, por seguridad y por ley:

- `/api/me` nunca recibe `workerId`: siempre actúa sobre la persona de la sesión.
- Borrar la cuenta de alguien que ya trabajó no borra los recibos de pago (la empresa debe conservarlos):
  se borra todo lo demás y el perfil queda vacío y fuera de toda búsqueda. Sin contratos, no queda ni la fila.
- La constancia no se emite sola al terminar el curso: la emite la academia.
- Una academia evalúa solo las pruebas de su taller o de sus propios alumnos.
- "Paga a tiempo" es el porcentaje real de trabajos pagados hasta 3 días después del último día de obra, y solo
  se muestra con 5 o más contrataciones terminadas. Con el seed actual da 100 %, no el 96 % del guion.

Error corregido de la fase 3: dos personas que aceptaban una invitación en el mismo instante podían recibir
un error 500 (SQLite admite un solo escritor). Ahora la transacción toma el candado al empezar y reintenta.
Probado con base local; falta confirmarlo contra Turso remoto.

## Fase 5b · Audio, transcripción y agentes — lista en código (publicar agentes espera permisos de la clave)

- [x] `POST /api/voice/tts`: frase (≤ 400 caracteres) a voz de Nivi, con sesión de cualquier rol y tope por IP.
      Caché en la tabla `voice_clips` (huella sha256 de voz, modelo y texto): una frase se paga una sola vez.
      Probado contra ElevenLabs real: 648 ms la primera vez, 12 ms desde la caché.
- [x] `GET /api/voice/audio/:id`: sirve el MP3 de la caché (el id es la huella, no se puede adivinar)
- [x] `POST /api/voice/transcribe`: nota de voz (cuerpo binario `audio/webm`, `audio/mp4`, `audio/ogg`…, hasta 2 MB)
      → Scribe v2 en español → clasificación por palabras clave → reporte en revisión humana.
      Probado con Scribe real: 710 ms y queda como "inseguridad" con la guía del INPSASEL.
- [x] La bitácora registra "TTS · nota de voz" y "Scribe v2 · reporte" con su latencia, sin el texto
- [x] `npm run audio:gen`: 5 lecciones, el resumen de privacidad (`/audio/privacidad.mp3`) y la felicitación de
      Carlos (`/audio/nivel-3-carlos.mp3`) generados y commiteados; el seed apunta cada lección a su MP3 y su
      duración real. Un manifiesto evita regenerar (y pagar) lo que no cambió.
- [x] `npm run agents:setup`: publica los dos agentes y sus 7 herramientas webhook (idempotente, por nombre),
      con autenticación obligatoria, el secreto de herramientas guardado en ElevenLabs y el contexto como variable
      secreta en `x-nivel-context`. `--dry-run` muestra exactamente lo que publica.
- [x] `npm run voice:check`: conversa por texto con Nivi contra la app desplegada y confirma que el perfil se
      crea, cosa que solo pasa si la variable secreta llegó en la cabecera.
- [x] 408 pruebas; cobertura de líneas 97 %
- [ ] Publicar los agentes y correr `voice:check` (esperan los permisos de la clave y la URL de Vercel)
- [ ] Efectos de sonido (`/sfx/*.mp3`): el script ya los tiene, falta el permiso de Sound Effects
- [ ] Notas de voz de invitación pregeneradas: hoy salen de la caché dinámica tras el primer uso (un ensayo las deja listas)
- [ ] Audios del plan B: se generan cuando exista el guion de la fase 9

Decisiones:

- **Voz de Nivi: "Clari"** (`9Ux14cxOYULytGFBVsW4`), voz venezolana de la biblioteca de ElevenLabs. La clave no tiene
  permiso de Voice Design; con ese permiso, `npm run audio:gen -- --design-voice` crea la voz propia.
- **Caché en la base, no en Vercel Blob:** no hay `BLOB_READ_WRITE_TOKEN` y la base ya está en todas partes. El
  reset no toca la caché.
- **El audio de las notas de voz no se guarda**, solo la transcripción: es lo que revisa el equipo (minimización).
- **Subida binaria en vez de multipart:** el cliente manda el `Blob` de `MediaRecorder` tal cual con su
  `Content-Type`. Menos código y menos superficie de ataque.

## Fase 6 · Sistema visual y páginas legales — lista

- [x] Identidad de Bytes: colores del manual, Inter servida desde nuestro dominio, logos optimizados en `/brand`
- [x] Componentes base en `src/components/ui`: botón, tarjeta, etiqueta, insignia de nivel, avatar de iniciales,
      barra de avance, avisos, precio con IVA aparte, marco de teléfono y orbe de voz
- [x] Textos fijos de la revisión legal en un solo lugar (`src/lib/legal-copy.ts`)
- [x] `/legal/terminos`, `/legal/privacidad` y `/legal/niveles`; la tabla de niveles y las tarifas salen de las
      mismas reglas que usa el cálculo
- [x] Portada, página de "no encontrada" y galería del sistema visual en `/estilo`
- [x] Cliente de la API para las pantallas (`src/client/api.ts`) con errores listos para mostrar
- [x] Una prueba revisa que ninguna pantalla use palabras prohibidas ni medios de pago no permitidos
- [x] 427 pruebas; cobertura de líneas 99 %

Revisado en un navegador real (Chromium, 1440 px y 390 px) sobre el servidor de producción: axe sin
hallazgos WCAG 2.1 A y AA, cero errores de consola, cero violaciones de CSP, sin desbordes y con botones de
48 px. Esa revisión se corre a mano; todavía no está en CI.

Hallazgos de esa revisión, ya corregidos:

- `next/image` añade un `style` en línea que nuestra CSP bloquea: los logos van con `<img>`.
- El ámbar del manual (#A86A00) no llegaba a contraste AA sobre su fondo: el texto usa #8A5600.
- La página de "no encontrada" ahora también se renderiza por petición y lleva su nonce.

## Decisiones

- **Sin Cache Components.** La CSP con nonce exige renderizar cada página por petición, y la demo es en vivo.
- **Kit v2.** Sin WhatsApp ni telefonía: toda la voz dentro de la app (`NiviVoice`), widget oficial como plan C.

## HUMANO

- HUMANO: crear el proyecto en Vercel conectado a ese repositorio.
- HUMANO: confirmar créditos de ElevenLabs (Agents, TTS, STT, Sound Effects).
- HUMANO: crear la base en Turso y poner en Vercel `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `SESSION_SECRET`,
  `DEMO_RESET_KEY`, `TOOL_SECRET` y `NEXT_PUBLIC_APP_URL` (ver `.env.example`).
- HUMANO: poner `ELEVENLABS_API_KEY` y `EL_VOICE_ID=9Ux14cxOYULytGFBVsW4` en Vercel.
- HUMANO: en elevenlabs.io → Developers → API Keys, darle a la clave los permisos de ElevenAgents (lectura y
  escritura), Sound Effects y, para la voz propia, Voices (escritura) y Voice Generation. Sin ElevenAgents,
  `/api/el/token` falla y no se pueden publicar los agentes.
- HUMANO: con la URL de Vercel lista, correr `npm run agents:setup` (con `NEXT_PUBLIC_APP_URL` y `TOOL_SECRET`
  iguales a los de Vercel), poner en Vercel los `EL_AGENT_*_ID` que imprime y correr `npm run voice:check`.
