# NIVEL · Demo funcional para Hackathon ValenValley 2026

> Documento maestro para Claude Code. Léelo completo antes de escribir código.
> Equipo: Bytes Technology. Tiempo total: **15 horas** desde H0. Objetivo: **1.er lugar** y **mejor proyecto creado con ElevenLabs**.
> Idioma de la interfaz: español venezolano (tú). Identificadores de código: inglés.

---

## 0. Cómo debes trabajar (léelo primero)

1. **Prioridad absoluta: el "camino dorado" (sección 3) funcionando de punta a punta en la URL desplegada.** Nada de P1/P2 hasta que el P0 pase `npm run smoke`.
2. **Despliega en la hora 1** (Vercel) y vuelve a desplegar en cada hito. Los agentes de ElevenLabs llaman a nuestras APIs por webhook, así que necesitan una URL pública desde temprano.
3. **Commits pequeños y frecuentes** (`feat:`, `fix:`). Después de cada bloque: `npm run build` + `npm test`. Si algo rompe el build, se arregla antes de seguir.
4. **Lleva `PROGRESS.md`** en la raíz: qué está hecho, qué falta, qué decidiste y por qué. Los humanos lo leen cada hora.
5. **No te bloquees.** Si falta una clave o un paso en un panel web, escribe en `PROGRESS.md` la instrucción exacta para el humano ("HUMANO: …") y sigue con otra tarea.
6. **Todo lo que dependa de red tiene plan B** (sección 12). La demo no puede depender de que el Wi‑Fi del evento funcione.
7. **Las reglas legales de la sección 8 no se negocian.** Si una pantalla de referencia (carpeta `reference/`) contradice la sección 8 (por ejemplo, estrellas visibles para empresas), manda la sección 8.
8. **Nada de datos inventados presentados como reales.** Toda la data es "de ejemplo" y la interfaz lo dice en el pie.
9. Antes de empezar, instala las skills de ElevenLabs para que conozcas la API actual:
   ```bash
   npx skills add elevenlabs/skills
   npm install -g @elevenlabs/cli && elevenlabs generate-skills
   ```
   Índice completo de la documentación (para consultar formas exactas de la API): https://elevenlabs.io/docs/llms.txt

---

## 1. El producto en 30 segundos

**NIVEL — "Capacítate. Trabaja. Sube de nivel."** El "Cashea del talento" para oficios en Venezuela.

- **Problema:** los contratistas de construcción y mantenimiento industrial arman una cuadrilla nueva en cada obra y tardan de 1 a 3 semanas en conseguir gente confiable. Nadie puede probar quién sabe hacer qué; todo se resuelve con "palanca" y grupos de WhatsApp.
- **Solución:** el trabajador se registra **hablando** (sin formularios), se capacita con academias aliadas (lecciones en audio), demuestra su oficio en una prueba práctica, trabaja, y sube de nivel con datos verificables. El contratista pide la cuadrilla **hablando** ("3 soldadores desde el martes en Los Guayos") y la tiene armada en minutos.
- **Promesa:** **"Contrata rápido y en regla."** NIVEL es la plataforma; el patrono siempre es el contratista.
- **Por qué voz primero (el corazón del premio ElevenLabs):** el trabajador de obra vive en notas de voz, muchas veces con poca señal, manos ocupadas y poca paciencia para formularios. La voz no es un adorno: es la interfaz que hace que esta población entre al sistema.
- **Toda la voz vive dentro de la app.** Sin WhatsApp Business, sin comprar números, sin telefonía. El trabajador abre un enlace (o escanea un QR) y habla desde el navegador del teléfono. La experiencia se siente como mandar notas de voz: "mantén presionado para hablar".
- **Modelo de negocio:** el trabajador nunca paga por buscar trabajo. El contratista paga por contratación ($15–$50 según nivel) o Plan Obra $39/mes. Las academias pagan 15% por alumno. Todo **+ IVA 16%**.

Usuarios (3 lados + operación):
| Rol | Superficie | Ruta |
|---|---|---|
| Trabajador | App móvil (PWA en marco de teléfono en desktop) | `/t` |
| Contratista | Web | `/c` |
| Academia | Panel web | `/a` |
| Equipo NIVEL | Revisión humana de reportes + métricas | `/admin` |
| Presentador | Modo Jurado (pantalla dividida + bitácora en vivo) | `/demo` |

---

## 2. Cómo se gana (diseña todo para esto)

El jurado evalúa **negocio, producto, calidad técnica e innovación (25% cada uno)**. Además compiten por **mejor proyecto creado con ElevenLabs**.

| Criterio | Qué tiene que VER el jurado en la demo |
|---|---|
| Producto | Un flujo real de punta a punta: pedido por voz → candidatos → invitación → contrato → asistencia → pago registrado → recibo → nivel sube. En dos pantallas a la vez. |
| Calidad técnica | URL pública, APIs reales de ElevenLabs (no grabaciones), **bitácora en vivo** que muestra cada llamada (agente, herramienta, TTS, STT) con su latencia, tests que pasan, reset en 1 clic. |
| Innovación | Voz como interfaz para una población excluida de lo digital + **legal por diseño** (calificaciones privadas, NIVEL no es patrono, revisión humana). Nadie más va a llevar eso. |
| Negocio | Precios visibles con IVA, comisión de academias, panel con ingresos calculados desde la data de la demo, costo legal real de cada contratación. |
| ElevenLabs | 5 productos usados con sentido: **ElevenAgents con herramientas** (2 agentes), **TTS** (lecciones y notas de voz), **Scribe STT** (reportes por nota de voz), **Sound Effects** (sonidos de la app), **Voice Design** (voz propia "Nivi"). Todo dentro de la app: llamada en vivo, notas de voz con "mantén presionado" y texto, sin números de teléfono. |

**Momento "wow" que debe salir perfecto:** el contratista habla 15 segundos y el tablero se llena solo en vivo: solicitud creada, 6 candidatos verificados, costo legal estimado, tarifa + IVA, invitaciones enviadas; uno rechaza, el sistema sugiere el reemplazo, y en el teléfono del trabajador del escenario llega una nota de voz con la invitación.

---

## 3. Alcance

### P0 — Camino dorado (obligatorio, H0–H7)
1. **Contratista pide cuadrilla por voz** (agente "Nivi Empresas") → herramientas `crear_solicitud` e `invitar_candidatos` → el tablero `/c` se actualiza en vivo. Dos invitados aceptan, uno rechaza (bot de demo) → tarjeta "Reemplazo sugerido: Carlos R." → Invitar.
2. **Trabajador recibe invitación** en `/t`: tarjeta con nota de voz (TTS) + aceptar/rechazar.
3. **Contrato directo** empresa–trabajador: la empresa lo deja firmado al publicar la solicitud (misma plantilla) y el trabajador firma con código (OTP simulado). Texto "NIVEL no es el patrono".
3b. **Avanzar a fin de obra** (botón del Modo Jurado): crea la asistencia de los días 2 a 5 para comprimir la semana en un clic.
4. **Entrada a la obra** con geocerca (y control de demo "simular que estoy en la obra").
5. **Fin de obra:** el contratista registra el pago (Pago Móvil, fuera de NIVEL) → **recibo** imprimible (LOTTT art. 106) → el trabajador confirma que recibió.
6. **Calificación doble ciega y privada** → **recalcular nivel** con la fórmula verificable → pantalla "¡Subiste de nivel!" con sonido.
7. **Registro de trabajador nuevo por voz** (agente "Nivi") → herramienta `guardar_perfil` → perfil + ruta recomendada + primera lección en audio.
7b. **Componente `NiviVoice` con 3 modos** sobre el mismo agente (sección 7.1): **nota de voz** (mantén presionado para hablar, modo por defecto en el teléfono), **llamada** (manos libres, modo por defecto en `/c`) y **texto** (si no hay micrófono o hay mucho ruido).
8. **Modo Jurado `/demo`**: teléfono (iframe `/t`) + web (iframe `/c`) lado a lado, bitácora en vivo, botón Reset, QR para que el jurado pruebe el registro en su teléfono.
9. **Seed realista** + `POST /api/demo/reset` + `npm run smoke` (recorre el camino dorado sin voz, por API).

### P1 — Fuerza (H7–H11)
10. **Reporte por nota de voz** (Scribe v2) → clasificación → cola de **revisión humana** en `/admin/revision`. Sin pausas automáticas.
11. **"Mis datos"** en `/t/mis-datos`: ver, descargar (JSON), corregir, borrar; ver calificaciones privadas.
12. **Panel de academia** `/a`: cursos, inscripciones, pruebas prácticas del día, ranking con fórmula publicada, comisión 15% + IVA.
13. **Calculadora de costo legal** visible en `/c` y devuelta por el agente.
14. **Lecciones en audio** pregeneradas (TTS) con reproductor y descarga para escuchar sin conexión.
15. **Voz propia "Nivi"** con Voice Design, usada en agentes y TTS.
16. **Sound Effects** pregenerados (subir de nivel, notificación, éxito).
17. **Panel interno `/admin`**: métricas (trabajadores, solicitudes, tiempo a cuadrilla, ingresos con IVA separado).
18. **Preflight `/demo/check`**: verifica claves, agentes, DB, audios, micrófono.
19. **Plan B** (`?planb=1`): conversación guionizada con audios pregenerados que ejecuta las mismas herramientas.
19b. **Plan C**: el widget oficial de ElevenLabs (una etiqueta HTML) en `/t/registro?widget=1` y `/c?widget=1`. Usa los mismos agentes y las mismas herramientas webhook, así que la DB y la bitácora se actualizan igual.
19c. **Prueba con usuarios reales** (sección 7.8): perfiles reales creados hoy, marcados `is_real`, contados en `/demo`.

### P2 — Brillo (solo si P0 y P1 están verdes a H11)
20. **Modo con poca señal:** la app se instala como PWA ("Agregar a pantalla de inicio") y las lecciones descargadas, el perfil y la constancia funcionan sin conexión (service worker). Resuelve un problema real de conectividad en Venezuela.
21. **Evaluador técnico por voz** (pre‑evaluación oral de soldadura que recomienda curso; NO asigna nivel).
22. **Música** corta de intro generada con Eleven Music para la pantalla de inicio de `/demo`.
23. Vacante dictada por voz con Scribe v2 Realtime.

### Fuera de alcance (dilo si preguntan)
Autenticación real (hay selector de personas de demo), pagos reales, facturación SENIAT real (se muestra factura simulada y "integración con imprenta digital autorizada: fase 2"), SMS real (OTP se muestra en pantalla como "simulado"), app nativa.

---

## 4. Stack y estructura

**Decisión:** Next.js (App Router, última estable) + TypeScript + Tailwind CSS v4 + Drizzle ORM + **Turso/libSQL** (en local: `file:local.db`) + Vercel. Un solo repo y un solo despliegue para UI y API, y es la ruta más rápida con el SDK oficial `@elevenlabs/react`.

Paquetes:
```bash
npx create-next-app@latest nivel --ts --tailwind --app --eslint --src-dir --import-alias "@/*"
npm i @elevenlabs/react @elevenlabs/elevenlabs-js drizzle-orm @libsql/client @vercel/blob zod swr qrcode nanoid
npm i -D drizzle-kit vitest tsx @types/qrcode
# opcional para clasificar texto de reportes y extraer datos:
npm i @anthropic-ai/sdk
```

Tiempo real entre pantallas: **polling con SWR cada 1 s** mientras haya una sesión activa (más robusto que websockets en un evento).

Archivos: el sistema de archivos de Vercel no persiste. Audios pregenerados → `/public/audio` (commiteados). Audios dinámicos (TTS de invitaciones nuevas) y notas de voz subidas → **Vercel Blob**, con la URL guardada en DB (caché por hash del texto).

Estructura:
```
src/
  app/
    page.tsx                      # landing mínima con accesos
    demo/page.tsx                 # Modo Jurado
    demo/check/page.tsx           # Preflight
    t/...                         # trabajador (móvil)
    c/...                         # contratista
    a/...                         # academia
    admin/...                     # métricas + revisión humana
    recibo/[id]/page.tsx          # recibo imprimible (art. 106)
    legal/(terminos|privacidad|niveles)/page.tsx
    api/
      tools/...                   # webhooks que llaman los agentes de ElevenLabs
      el/token/route.ts           # token de conversación (WebRTC) por agente
      voice/tts/route.ts          # TTS dinámico con caché
      voice/transcribe/route.ts   # Scribe v2 para notas de voz
      demo/reset/route.ts
      events/route.ts             # bitácora
      ...                         # CRUD de la app (sección 10)
  db/schema.ts  db/index.ts  db/seed.ts
  lib/
    level.ts       # fórmula de nivel (pura + tests)
    pricing.ts     # tarifas, IVA, comisión (pura + tests)
    legalCost.ts   # costo legal estimado (pura + tests)
    matching.ts    # búsqueda de candidatos (pura + tests)
    moderation.ts  # requisitos prohibidos en vacantes (pura + tests)
    geo.ts         # haversine + geocerca
    events.ts      # logEvent()
    elevenlabs.ts  # cliente server con timeouts y reintento único
  components/      # PhoneFrame, VoiceOrb, AudioNote, LevelBadge, EventLog, ConsentSheet...
scripts/
  setup-agents.ts      # crea/actualiza los 2 agentes y sus herramientas (si no usas el CLI)
  generate-audio.ts    # pregenera TTS, SFX y audios de plan B en /public/audio
  smoke.ts             # recorre el camino dorado por API
public/audio/  public/sfx/  public/brand/
```

Scripts de `package.json`: `dev`, `build`, `start`, `test` (vitest), `db:push`, `db:seed`, `audio:gen`, `agents:setup`, `smoke`.

### Variables de entorno (`.env.local` y Vercel)
```
ELEVENLABS_API_KEY=
EL_AGENT_WORKER_ID=          # agente "Nivi" (trabajador)
EL_AGENT_CONTRACTOR_ID=      # agente "Nivi Empresas"
EL_VOICE_ID=                 # voz "Nivi" (Voice Design) o una voz en español de la biblioteca
TOOL_SECRET=                 # se envía en el header x-tool-secret desde cada herramienta webhook
TURSO_DATABASE_URL=          # local: file:local.db
TURSO_AUTH_TOKEN=
NEXT_PUBLIC_APP_URL=         # https://<proyecto>.vercel.app
DEMO_RESET_KEY=
ANTHROPIC_API_KEY=           # opcional (clasificación/extracción). Sin clave: reglas por palabras clave.
BLOB_READ_WRITE_TOKEN=       # Vercel Blob para audios dinámicos y notas de voz
```
La clave de ElevenLabs **solo vive en el servidor**. El navegador recibe un token de conversación.

HUMANO (H0): confirmar que el plan de ElevenLabs tiene créditos suficientes para Agents, TTS y STT durante ensayos y demo, y que la clave tiene permisos para ConvAI, TTS, STT y Sound Effects.

---

## 5. Datos

### 5.1 Esquema (Drizzle, SQLite)
Usa `id` texto (`nanoid`) y fechas ISO. Tablas:

- `companies` — id, name, rif, verified (bool), kind (`contratista`|`empresa`), zone, lat, lng
- `academies` — id, name, rif, city
- `workers` — id, name, phone, is_adult (bool), trade (`soldador`|`electricista`|`albanil`|`plomero`|`pintor`|`otro`), years_exp, skills (json), zone, lat, lng, availability, level (1–5), photo_url, created_via (`voz`|`texto`|`seed`), is_real (bool, registro de una persona real durante el evento), consent_voice_at, consent_selfie_at, consent_gps_at, consent_notifications_at, consent_share_profile_at, created_at
- `courses` — id, academy_id, title, trade, price_usd, weeks, mode, free (bool), installments (json, ofrecidas por la academia)
- `lessons` — id, course_id, order, title, script, audio_url, duration_s
- `enrollments` — id, worker_id, course_id, status, progress
- `practical_tests` — id, worker_id, trade, workshop, evaluator, score, max_score, passed (bool), insured (bool), date
- `certificates` — id, worker_id, course_id, code (p. ej. `C-2041`), issued_by_academy_id, date  *(se muestra como "constancia")*
- `job_requests` — id, company_id, trade, quantity, min_level, zone, lat, lng, start_date, days, daily_pay_usd, contract_type (`obra_determinada`|`tiempo_determinado`|`servicio_independiente`), status (`abierta`|`completa`|`cerrada`), created_via (`voz`|`web`), created_at
- `invitations` — id, request_id, worker_id, status (`enviada`|`aceptada`|`rechazada`), channel (`app`), audio_url, created_at, responded_at
- `contracts` — id, request_id, company_id, worker_id, contract_type, daily_pay_usd, days, otp_code, signed_worker_at, signed_company_at, status
- `attendance` — id, contract_id, date, check_in_at, check_out_at, inside_geofence (bool), note
- `payments` — id, contract_id, amount_usd, amount_bs, method (`pago_movil`|`transferencia`), reference, receipt_number, registered_at, confirmed_by_worker_at
- `ratings` — id, contract_id, from_role (`empresa`|`trabajador`), to_id, quality, punctuality, safety, attitude, tags (json), comment, submitted_at, revealed_at  *(privadas)*
- `incidents` — id, worker_id, kind (`identidad_falsa`|`ausencia_confirmada`|`violencia`), verified_by, verified_at  *(solo verificados cuentan para nivel)*
- `reports` — id, reporter_worker_id, company_id, kind (`no_pago`|`inseguridad`|`oferta_falsa`|`acoso`|`otro`), text, audio_url, transcript, status (`en_revision`|`resuelto`|`descartado`), reviewer_note, created_at, reviewed_at
- `fees` — id, company_id, concept, base_usd, iva_usd, total_usd, invoice_number, status (`por_pagar`|`pagado`), method
- `events` — id, ts, actor, type, label, detail (json), latency_ms, product (`agents`|`tts`|`stt`|`sfx`|`app`)
- `demo_state` — key, value  *(empresa activa, trabajador activo, ubicación simulada)*

### 5.2 Seed canónico (debe coincidir con el video demo)
Pie de página en todas las pantallas: **"Demo · nombres, empresas y cifras de ejemplo"**.

- **Empresas:** Constructora Los Guayos (RIF J-50123456-7, verificada, **empresa activa de la demo**), Talleres Morón, Herrería El Prado, Metálicas Tocuyito.
- **Academias:** Academia Técnica Carabobo (Valencia), Taller Escuela Los Guayos (pruebas prácticas; evaluador Ing. M. Pérez).
- **Cursos:** "Soldadura SMAW en estructuras" ($120, 6 semanas, presencial + audio, cuotas 4 × $30 **ofrecidas por la academia**); "Seguridad en trabajos en caliente" (gratis, audio, 3 lecciones) → es la **ruta gratis** de nivel 1 a 2 junto con la prueba práctica.
- **Trabajadores (40):** incluye estos con estos datos exactos:
  - Carlos Rodríguez — soldador, 2 años, SMAW, Los Guayos, nivel 2 (prueba práctica aprobada 4/4, constancia C-2041), 2 trabajos confirmados (le falta 1 para nivel 3).
  - Rafael Torres — soldador, nivel 3, a 4,0 km de la obra.
  - Andrés Silva — soldador, nivel 5 (ocupado en otra obra esta semana: **no** disponible).
  - José Pérez — soldador, nivel 3. Luis Mendoza — soldador, nivel 3 (en la demo rechaza la invitación).
  - El resto repartidos en 6 oficios y estas zonas (lat, lng aproximadas): Valencia (10.162, -68.007), Los Guayos (10.186, -67.938), San Diego (10.258, -67.954), Naguanagua (10.257, -68.012), Guacara (10.232, -67.877), Tocuyito (10.104, -68.073), Puerto Cabello (10.473, -68.012), Morón (10.488, -68.200). Que haya **exactamente 6 soldadores** que cumplan "nivel ≥ 2, ≤ 25 km de Los Guayos, disponibles el martes": Rafael (N3), José (N3), Luis (N3), Carlos (N2), y dos de nivel 2 a 12 y 20 km. Con la fórmula de 6.4, el orden debe ser Rafael, José, Luis, **Carlos**, … (añade un test que lo verifique).
- **Obra:** "Obra Los Guayos", Av. Principal de Los Guayos (10.186, -67.938), geocerca de 120 m.
- Historial para que `/admin` y `/a` tengan números creíbles: ~25 contrataciones pasadas, pagos, tarifas cobradas, 12 inscripciones del mes.

---

## 6. Reglas de negocio (funciones puras con tests en `lib/`)

### 6.1 Nivel (`lib/level.ts`) — fórmula pública, verificable
Entradas: `confirmedJobs` (trabajos con asistencia y pago confirmados por ambas partes), `practicalPassed`, `certificates`, `attendanceRate` (0–1), `verifiedIncidents`, `ratings` (array privado).

| Nivel | Nombre | Requisito |
|---|---|---|
| 1 | Aprendiz | Registro + mayor de 18 |
| 2 | Verificado | Prueba práctica aprobada **o** 1 constancia de academia |
| 3 | Probado | Nivel 2 + 3 trabajos confirmados + 0 incidentes verificados |
| 4 | Confiable | 10 trabajos confirmados + asistencia ≥ 90% + 0 incidentes verificados |
| 5 | Maestro | 25 trabajos confirmados + 2 constancias + asistencia ≥ 95% |

- Las calificaciones privadas **nunca bajan el nivel por sí solas**. Solo pueden **frenar** el ascenso a 4 y 5 si el promedio interno con **5 o más** calificaciones es < 3,5 (peso máximo 20% del criterio). Las calificaciones de más de 12 meses no cuentan.
- Calificaciones entre partes con un reporte abierto quedan congeladas (no cuentan).
- Exporta también `explainLevel()` que devuelve texto: "Te falta 1 trabajo confirmado para Nivel 3". Se muestra en la app y la página `/legal/niveles` publica la tabla.
- Banda de **referencia de mercado** por nivel (no es promesa): N1 $160–$240, N2 $240–$300, N3 $300–$350, N4 $350–$450, N5 $450–$600 al mes.

### 6.2 Precios (`lib/pricing.ts`)
- Tarifa por contratación según nivel del trabajador: N1 $15, N2 $20, N3 $30, N4 $40, N5 $50.
- Plan Obra $39/mes con 3 contrataciones incluidas; extras $20. Plan Empresa $129/mes.
- Comisión academia 15% del curso.
- **IVA 16% siempre aparte**: `{ base, iva: round2(base*0.16), total }`. Mostrar "más IVA".
- Cobro solo en bolívares: Pago Móvil o transferencia (mostrar equivalente con una tasa de ejemplo configurable, etiquetada "tasa de ejemplo").
- La tarifa por contratación se genera **cuando el trabajador acepta**. Si nadie acepta, no se cobra.
- **Garantía de búsqueda:** si la contratación no funciona dentro de 7 días, NIVEL busca otro candidato sin cobrar otra tarifa.

### 6.3 Costo legal estimado (`lib/legalCost.ts`)
Para `dailyPay`, `days`, `quantity`:
```
salary        = dailyPay * days
utilidades    = salary * 30/360          // mínimo legal 30 días/año, proporcional
vacacionesBono= salary * 30/360          // 15 días vacaciones + 15 bono vacacional, proporcional
prestaciones  = salary * 15/90           // garantía 15 días por trimestre, proporcional
pensiones     = salary * 0.09            // contribución especial 9%
aportes       = salary * 0.15            // IVSS+RPE+FAOV+INCES, estimado simplificado
total         = suma; perWorker y totalQuantity
```
Ejemplo de test: $25 × 5 días → salario 125,00; total ≈ 196,67 por trabajador. Mostrar siempre: **"Estimado. Valídalo con tu contador."**

### 6.4 Búsqueda de candidatos (`lib/matching.ts`)
Filtrar por oficio, `level >= min_level`, disponible en la fecha, distancia ≤ 25 km (haversine). Ordenar por `level*10 + confirmedJobs*1.5 + (practicalPassed?5:0) - distanceKm*0.5`. **No usa calificaciones** (privacidad). Devuelve: nombre corto ("Rafael T."), nivel, trabajos confirmados, prueba práctica sí/no, constancias, distancia. **Nunca** foto, edad, sexo ni estrellas.

### 6.5 Moderación de vacantes (`lib/moderation.ts`)
Bloquear y explicar si el texto o los filtros piden: sexo/género ("solo hombres"), edad ("menor de 30", "entre 20 y 35"), "buena presencia", nacionalidad, religión, estado civil, embarazo, discapacidad, o pedir dinero al candidato. Tests con 10 frases.

---

## 7. ElevenLabs: qué usamos y para qué

| # | Producto | Uso en NIVEL | Dónde |
|---|---|---|---|
| 1 | **ElevenAgents** (2 agentes con herramientas webhook) | Registro del trabajador por voz; pedido de cuadrilla por voz del contratista | `/t/registro`, `/c` |
| 2 | **Text to Speech** | Lecciones en audio (pregeneradas), notas de voz de invitación (dinámicas con caché), "escuchar antes de aceptar" en consentimientos | `/t/aprender`, `/t/ofertas`, hojas de consentimiento |
| 3 | **Speech to Text (Scribe v2)** | Reportes por nota de voz (no pago, inseguridad) → transcripción → cola de revisión humana | `/t/ayuda`, `/admin/revision` |
| 4 | **Sound Effects** | Sonidos propios: subir de nivel, notificación, éxito | toda la app |
| 5 | **Voice Design** | Voz de marca "Nivi" (venezolana) usada por agentes y TTS | global |
| 6 | **Agente dentro de la app** (sin telefonía) | Mismo agente en 3 modos: nota de voz (mantén presionado), llamada y texto. Widget oficial como plan C | `NiviVoice` en `/t` y `/c` |

Modelos (confirma con la doc antes de codificar):
- Agentes en tiempo real: `eleven_v4_turbo` (más expresivo) o `eleven_flash_v2_5` (más barato y rápido).
- Lecciones pregeneradas: `eleven_v4` o `eleven_multilingual_v2`.
- Notas de voz dinámicas: `eleven_flash_v2_5`.
- Transcripción: `scribe_v2` (lote). `scribe_v2_realtime` solo para P2.
- Efectos: `eleven_text_to_sound_v3`.

### 7.1 Conexión de agentes desde el navegador
- Endpoint propio `GET /api/el/token?agent=worker|contractor` → llama a `GET https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=…` con header `xi-api-key` y devuelve `{ token }`.
- Cliente: `useConversation()` (o `ConversationProvider` + hooks) y `startSession({ conversationToken })`. Pide el micrófono antes con una pantalla que explique para qué ("Para hablar con Nivi. No guardamos el audio.").
- `onMessage` → pinta la transcripción en vivo en pantalla y la manda a la bitácora (`/api/events`).
- Muestra un **orbe de voz** animado con el volumen de entrada/salida.
- Variables dinámicas: pasa `worker_id` / `company_id` si el SDK lo permite (verifica la sintaxis en la doc); si no, las herramientas usan la persona activa de `demo_state`.

**Componente `NiviVoice` (un solo componente, 3 modos, mismo agente):**
- **Nota de voz (mantén presionado)** — modo por defecto en el teléfono. La sesión del agente se abre al entrar a la pantalla, pero con el micrófono silenciado usando el estado controlado `micMuted` del SDK. Mientras el usuario mantiene presionado el botón, `micMuted=false`; al soltar, `micMuted=true`. La respuesta de Nivi suena y aparece como burbuja de texto con su audio. Por qué: (1) se siente como mandar notas de voz, que es lo que el trabajador ya sabe hacer; (2) el ruido del evento y de la obra no dispara turnos falsos ni interrumpe al agente. Si el agente no responde ~1 s después de soltar, enviar `sendUserActivity()`/esperar y mostrar "Nivi está pensando…".
- **Llamada (manos libres)** — modo por defecto en `/c` (el contratista habla con el agente como en una llamada). Micrófono abierto, orbe animado, botón "Colgar".
- **Texto** — `textOnly` o `sendUserMessage()`. Para cuando no hay micrófono, no se puede hablar o el lugar es muy ruidoso. Mismas herramientas.
- Selector de modo pequeño arriba del componente (íconos: micrófono, teléfono, teclado). El modo elegido se recuerda en `localStorage`.
- En la configuración del agente: subir el umbral de interrupción / bajar la sensibilidad a ruido si la plataforma lo permite, y un tiempo de espera de turno corto (revisa los campos de turno y VAD en la doc).
- **Plan C (widget oficial):** `<elevenlabs-convai agent-id="…">` con el script `@elevenlabs/convai-widget-embed`. Si el componente propio falla, se cambia a `?widget=1` y la demo sigue: las herramientas son webhooks y escriben en la misma DB.

### 7.2 Herramientas: **webhooks del servidor** (no client tools)
Así toda la lógica vive en el servidor, funciona igual desde cualquier modo (nota de voz, llamada, texto o widget) y queda en la bitácora. Cada herramienta: `POST {NEXT_PUBLIC_APP_URL}/api/tools/<nombre>` con header `x-tool-secret: {TOOL_SECRET}`, marcada como **bloqueante** (el agente espera la respuesta). Cada endpoint:
1. valida el secreto y el body con zod;
2. ejecuta la lógica y escribe en DB;
3. registra un evento (`product:'agents'`, con latencia);
4. responde JSON corto y **en lenguaje que el agente pueda leer en voz alta** (campo `say`).

Opcional, solo para la UI: un client tool no bloqueante `mostrar_seccion({ seccion })` para resaltar una tarjeta en `/c`.

### 7.3 Agente 1 — "Nivi" (trabajador)
- Idioma: español (`es`). Voz: `EL_VOICE_ID`. LLM: el más rápido con buen uso de herramientas disponible en la plataforma.
- Primer mensaje: **"¡Hola! Soy Nivi, de NIVEL. En dos minutos armamos tu perfil para que las empresas te encuentren. ¿Cómo te llamas?"**
- Prompt de sistema:
```
Eres Nivi, la asistente de voz de NIVEL, una plataforma venezolana que ayuda a trabajadores de oficios
(soldadura, electricidad, albañilería, plomería, pintura) a capacitarse, demostrar lo que saben y conseguir
trabajo con contratistas. Hablas español venezolano, cercano y respetuoso. Tuteas. Frases cortas:
máximo dos oraciones por turno. Sin tecnicismos. Si no entiendes, pide que lo repita. No inventes datos.

Objetivo: crear el perfil del trabajador en menos de dos minutos.
1. Pregunta su nombre.
2. Confirma que es mayor de 18 años. Si no lo es, explica con amabilidad que por ahora NIVEL es solo
   para mayores de 18 y despídete.
3. Pregunta: oficio principal, años de experiencia, técnicas o equipos que maneja, zona donde vive
   (municipio o sector, no la dirección exacta) y disponibilidad.
4. Resume en una frase lo que entendiste y pide confirmación.
5. Cuando confirme, llama a guardar_perfil. Lee en voz alta el campo "say" de la respuesta: la ruta
   recomendada y cómo sube de nivel.

Reglas que nunca rompes:
- No prometes empleo ni salarios. Las bandas son solo referencia de mercado.
- NIVEL no es su patrono: el contrato es directo con la empresa que lo contrata.
- Sus calificaciones son privadas. Las empresas ven su nivel, sus trabajos confirmados, su prueba
  práctica y sus constancias.
- No pides cédula, dirección exacta, religión, estado civil, salud, datos bancarios ni contraseñas.
- Si menciona falta de pago, accidente, condiciones inseguras o acoso, ofrece abrir un reporte
  confidencial con crear_reporte y dile que una persona del equipo lo revisa en menos de 24 horas.
- Si pide hablar con una persona, dile que el equipo lo contactará y llama a crear_reporte con tipo "otro".
```
- Herramientas:
```json
[
  {
    "name": "guardar_perfil",
    "description": "Crea el perfil del trabajador cuando ya confirmó sus datos.",
    "url": "/api/tools/guardar_perfil",
    "body": {
      "nombre": "string",
      "mayor_de_edad": "boolean",
      "oficio": "enum: soldador|electricista|albanil|plomero|pintor|otro",
      "anos_experiencia": "number",
      "tecnicas": "string[]",
      "zona": "string",
      "disponibilidad": "string",
      "conversation_id": "string (variable de sistema system__conversation_id)"
    },
    "returns": "{ worker_id, nivel, ruta: { curso_gratis, curso_recomendado, prueba_practica }, banda_referencia, say }"
  },
  {
    "name": "crear_reporte",
    "description": "Abre un reporte confidencial para revisión humana.",
    "url": "/api/tools/crear_reporte",
    "body": { "tipo": "enum: no_pago|inseguridad|oferta_falsa|acoso|otro", "descripcion": "string", "empresa": "string?" },
    "returns": "{ caso_id, say }"
  },
  {
    "name": "consultar_ofertas",
    "description": "Lista las invitaciones abiertas del trabajador (P1).",
    "url": "/api/tools/consultar_ofertas",
    "body": { "worker_id": "string?" },
    "returns": "{ ofertas: [...], say }"
  },
  {
    "name": "responder_oferta",
    "description": "Acepta o rechaza una invitación (P1).",
    "url": "/api/tools/responder_oferta",
    "body": { "invitacion_id": "string", "acepta": "boolean" },
    "returns": "{ estado, say }"
  }
]
```
- `guardar_perfil` crea el trabajador con `level=1` y guarda `consent_voice_at`. Para saber qué pantalla debe saltar al perfil (puede haber varios jurados registrándose a la vez), la herramienta recibe también `conversation_id` llenado con la variable de sistema `system__conversation_id` (verifica el nombre exacto en la doc). El cliente conoce su `conversationId` (lo devuelve `startSession`) y hace polling a `GET /api/workers/by-conversation/:id`. Respaldo: guardar el último `worker_id` creado desde ese dispositivo en `localStorage`.
- Base de conocimiento del agente: sube `docs/faq-legal.md` (genérala desde la sección 8 en 1 página).

### 7.4 Agente 2 — "Nivi Empresas" (contratista)
- Primer mensaje: **"Hola, soy Nivi de NIVEL. Dime qué gente necesitas y para cuándo, y te armo la cuadrilla."**
- Prompt de sistema:
```
Eres Nivi, la asistente de NIVEL para contratistas en Carabobo. Ayudas a pedir cuadrillas de trabajadores
verificados. Hablas español venezolano, profesional y directo. Frases cortas.

Objetivo: crear una solicitud completa en menos de un minuto y mostrar candidatos.
Datos necesarios: oficio, cantidad, nivel mínimo (1 a 5; si no sabe, sugiere nivel 2 o más, y nivel 3
para estructura crítica o trabajos con planos), zona, fecha de inicio, días y pago diario en dólares. Tipo de contrato:
por obra determinada si la obra tiene un fin claro; pregunta solo si no está claro.
Cuando tengas los datos, repítelos en una frase y llama a crear_solicitud. Lee el campo "say".
Pregunta si invita a los mejores candidatos. Si dice que sí, llama a invitar_candidatos y lee "say".

Reglas que nunca rompes:
- NIVEL no suministra personal: la empresa contrata directo y es el patrono.
- No aceptas criterios de edad, sexo, nacionalidad, religión, estado civil, embarazo, discapacidad ni
  "buena presencia". Si los piden, explica que no está permitido y sigue sin ese criterio.
- No compartes calificaciones individuales. Hablas de nivel, trabajos confirmados, prueba práctica y
  constancias.
- Los precios siempre son "más IVA". Se paga en bolívares por Pago Móvil o transferencia.
- El costo legal es un estimado: recomienda validarlo con su contador.
- Si pregunta por reemplazar a alguien: NIVEL busca otro candidato sin costo dentro de 7 días; la relación
  se termina según la LOTTT y los días trabajados se pagan.
```
- Herramientas:
```json
[
  {
    "name": "crear_solicitud",
    "url": "/api/tools/crear_solicitud",
    "body": {
      "oficio": "enum: soldador|electricista|albanil|plomero|pintor|otro",
      "cantidad": "integer",
      "nivel_minimo": "integer 1-5",
      "zona": "string",
      "fecha_inicio": "string (YYYY-MM-DD o texto como 'el martes')",
      "dias": "integer",
      "pago_diario_usd": "number",
      "tipo_contrato": "enum: obra_determinada|tiempo_determinado|servicio_independiente"
    },
    "returns": "{ solicitud_id, cumplen, top: [{ nombre_corto, nivel, trabajos_confirmados, prueba_practica, distancia_km }], costo_legal: { por_trabajador, total }, tarifa: { base, iva, total }, say }"
  },
  {
    "name": "invitar_candidatos",
    "url": "/api/tools/invitar_candidatos",
    "body": { "solicitud_id": "string", "cantidad": "integer" },
    "returns": "{ invitados: [{ nombre_corto, nivel }], say }"
  },
  {
    "name": "calcular_costo_legal",
    "url": "/api/tools/calcular_costo_legal",
    "body": { "pago_diario_usd": "number", "dias": "integer", "cantidad": "integer" },
    "returns": "{ desglose, total, say }"
  }
]
```
- Ejemplo de `say` de `crear_solicitud`: *"Listo. 6 soldadores de nivel 2 o más cumplen cerca de Los Guayos. El costo legal estimado es de unos 197 dólares por persona por los 5 días. La tarifa de NIVEL va de 20 a 30 dólares por contratación según el nivel, más IVA. ¿Invito a los 3 mejores?"*
- `fecha_inicio` en texto ("el martes") se resuelve en el servidor a la próxima fecha.
- `invitar_candidatos` invita a los siguientes N mejores que aún no fueron invitados (con `cantidad: 1` sirve para el reemplazo), genera (o toma de caché) la **nota de voz** de cada invitación con TTS y registra eventos.
- **Bot de demo** (`demo_state.bot = on`, se apaga desde `/demo`): Rafael y José aceptan a los ~3 s, Luis rechaza a los ~6 s. Al rechazar, `/c` muestra "Reemplazo sugerido: Carlos R. · Nivel 2 · prueba práctica aprobada · a 1,2 km" con botón Invitar (o el contratista lo pide por voz). **Carlos** recibe la invitación en el teléfono del escenario y acepta en vivo. El bot nunca actúa sobre Carlos.

### 7.5 Crear los agentes (en este orden de preferencia)
1. **CLI (agentes como código):** `elevenlabs agents init`, `elevenlabs agents add "Nivi" …`, configurar JSON en `agent_configs/`, agregar herramientas webhook y `elevenlabs agents push`. Guarda la config en el repo.
2. **Script REST** `scripts/setup-agents.ts` con `@elevenlabs/elevenlabs-js`.
3. **Manual en el panel** (si 1 y 2 fallan en 20 min): escribe en `PROGRESS.md` la lista exacta de campos para que un humano los copie (nombre, idioma, voz, LLM, primer mensaje, prompt, herramientas con URL, headers y body).
Guarda los IDs en `.env.local` y en Vercel.

### 7.6 TTS, SFX y Voice Design (`scripts/generate-audio.ts`)
Genera y guarda en `/public/audio` y `/public/sfx` (commitea los archivos: la demo no debe depender de generar audio en vivo):
- 3 lecciones de "Seguridad en trabajos en caliente" (60–90 s cada una): equipo de protección personal; orden y limpieza antes de soldar (extintor a mano, materiales inflamables lejos); ventilación y humos. Más 2 lecciones de "Soldadura SMAW": electrodos E6011 y E7018 y cuándo usar cada uno; posición y longitud de arco. Guiones cortos, claros, con el tono de Nivi.
- Notas de voz de invitación para Carlos, Rafael, José, Luis y Andrés (la ruta dinámica también existe, con caché por hash del texto).
- "Escuchar antes de aceptar": resumen de privacidad en 40 s.
- Felicitación de nivel: *"¡Felicidades, Carlos! Ya eres Nivel 3: Probado. Ahora apareces en búsquedas de nivel 3 o más."*
- SFX: subir de nivel (campanita brillante corta), notificación (dos tonos suaves), éxito (clic + brillo). Duración ≤ 1,5 s.
- Audios del **plan B** (sección 12): las respuestas del agente del camino dorado, en la voz de Nivi.
- **Voice Design (P1):** crea la voz "Nivi" con este prompt y usa su ID en todo: *"Mujer venezolana de unos 30 años, acento venezolano neutro de la región central, voz cálida, clara y segura, ritmo pausado, tono cercano y profesional, como una coordinadora de obra amable."* Si no da tiempo, elige una voz femenina latinoamericana de la biblioteca.

### 7.7 Notas de voz → Scribe (`/api/voice/transcribe`)
Grabador con `MediaRecorder` (webm/opus), máximo 60 s. Servidor: Scribe `scribe_v2`, idioma español. Luego clasificar en `no_pago|inseguridad|oferta_falsa|acoso|otro` (Anthropic si hay clave; si no, palabras clave) y crear `reports` con `status='en_revision'`. Respuesta al trabajador: *"Recibimos tu reporte. Es confidencial. Una persona del equipo lo revisa en menos de 24 horas."*

### 7.8 Prueba con usuarios reales (lo que convence al jurado de que funciona)
La mejor prueba de que NIVEL resuelve un problema real es que gente real lo use **hoy**.
- A partir de H9, compartir el enlace `/t/registro?real=1` (o el QR) con 3 a 5 trabajadores de oficio reales que conozca el equipo (soldador, electricista, albañil, personal de mantenimiento) y, si se puede, con 1 contratista real para que pruebe `/c` pidiendo una cuadrilla.
- Antes de hablar, pantalla de consentimiento clara: "Esto es una prueba de un proyecto de hackathon. Guardamos tu nombre, oficio y zona para mostrar que la app funciona. Puedes borrarlo cuando quieras en Mis datos."
- Los registros con `?real=1` se guardan con `is_real=true`. **Reset no los borra** (salvo que se pida con `?all=1`).
- En `/demo`, contador "Perfiles reales creados hoy: N" y lista con **solo nombre de pila, oficio y zona** (nada más).
- Si un contratista real prueba, guardar su comentario textual (con permiso) para citarlo en el pitch.
- Nunca inflar este número. Si son 3, se dice 3.

---

## 8. Reglas legales no negociables (vienen de la revisión legal; el PDF está en `docs/`)

1. **NIVEL no es el patrono.** El contrato es directo entre empresa y trabajador. Texto fijo en ofertas, contrato y aceptación: *"Contrato directo empresa–trabajador. NIVEL es la plataforma, no el patrono."*
2. **La app registra hechos, no da órdenes ni sanciona.** Nada de "llegada tarde" como sanción, ni pausas automáticas, ni "tus calificaciones suben o bajan su nivel".
3. **Calificaciones privadas.** La empresa **nunca** ve estrellas ni comentarios de otros. Ve: nivel, trabajos confirmados, prueba práctica, constancias y etiquetas positivas que el trabajador elija mostrar. El trabajador ve todo lo que dicen de él en "Mis datos". Calificación **doble ciega**: se revela cuando ambos califican o a los 7 días.
4. **Reportes → revisión humana** en menos de 24 h. El reportante queda anónimo frente a la empresa y su nivel no cambia. Mostrar cómo acudir a INPSASEL en reportes de inseguridad.
5. **Permisos separados y explícitos** (hoja de consentimiento con botón "Escuchar"): voz, selfie/prueba de vida, GPS, avisos (notificaciones), compartir perfil. **Solo mayores de 18.**
6. **Foto, edad y sexo ocultos** para empresas hasta que inviten a entrevista. Sin filtros discriminatorios (sección 6.5).
7. **GPS solo al marcar entrada y salida**, dentro de la geocerca. El contratista ve "Llegó 7:02 a. m.", nunca un mapa en vivo.
8. **Pagos:** el salario va directo del contratista al trabajador; NIVEL solo registra y genera el recibo (LOTTT art. 106). Las tarifas de NIVEL: **solo Pago Móvil o transferencia, + IVA 16%, factura digital** (simulada). **No** mostrar Zelle ni USDT en ninguna parte.
9. **Reemplazo = garantía de búsqueda de 7 días.** Antes de confirmar un reemplazo, aviso: terminar antes de tiempo tiene consecuencias legales; una falta aislada no es causa justificada (la LOTTT habla de 3 días hábiles de inasistencia injustificada en un mes, art. 79); los días trabajados se pagan.
10. **"Constancia", no "certificado oficial".** El QR muestra nombre, curso, fecha y academia; nunca la cédula.
11. **Palabras prohibidas en la UI y el pitch:** "garantizado", "certificado oficial", "100% verificado", "sin riesgo laboral", "sin pasivos".
12. **"Mis datos":** ver, descargar, corregir y borrar.
13. Cifras como "78% consigue trabajo" o "#1 en soldadura" solo si salen de la data de la app, con la fórmula visible.

---

## 9. Pantallas y criterios de aceptación

### `/t` Trabajador (móvil; en desktop se ve dentro de `PhoneFrame` de 390×844)
Barra inferior: Inicio · Mi ruta · Trabajos · Perfil.
- `/t/registro` — `NiviVoice` en modo nota de voz: botón grande "Mantén presionado para hablar con Nivi" + hoja de consentimiento (voz) + burbujas con transcripción y audio. Cuando `guardar_perfil` responde, transición a "Esto entendimos" (oficio, experiencia, técnicas, zona) con botón "Corregir" y "Confirmar". Alternativa "Prefiero escribir" (formulario mínimo).
- `/t` Inicio — nivel con insignia, `explainLevel()`, "Abierto a trabajar", banda de referencia, ofertas con nota de voz (reproductor tipo WhatsApp), empresa verificada + "Paga a tiempo 96%" (métrica objetiva, solo con 5+ contrataciones).
- `/t/oferta/[id]` — detalle, nota de voz, equipo de protección que da la empresa, "Contrato directo… NIVEL no es el patrono", Aceptar / Rechazar.
- `/t/contrato/[id]` — resumen del contrato (tipo, días, pago diario, total), código OTP "enviado por SMS (simulado)", firmar.
- `/t/obra` — "Llegué a la obra" (geolocalización real; si está fuera, botón de demo "Simular que estoy en la obra" solo con `?demo=1`), entrada/salida, jornada.
- `/t/fin/[contractId]` — "¿Recibiste tu pago de $125?" → Sí / No (No abre reporte). Calificar a la empresa con etiquetas ("Pagó a tiempo", "Buen trato", "Equipo de protección completo"). Nota: "La empresa verá tu calificación cuando ella también te califique."
- `/t/nivel` — "¡Subiste de nivel!" con SFX + voz de felicitación, criterios cumplidos, próximo nivel.
- `/t/aprender` — ruta: curso gratis (audio) + curso recomendado ($120 + IVA, cuotas ofrecidas por la academia) + prueba práctica. Reproductor de lecciones con descarga.
- `/t/ayuda` — reporte por nota de voz o texto; tipos; confirmación de revisión humana; enlace INPSASEL.
- `/t/mis-datos` — datos, permisos (revocar), calificaciones recibidas (privadas), descargar JSON, borrar cuenta.

### `/c` Contratista (web, 1440 px)
- Encabezado con empresa activa (Constructora Los Guayos · verificada · RIF).
- Panel izquierdo: **"Pide tu cuadrilla hablando"** (orbe + transcripción) y alternativa formulario.
- Panel central en vivo (polling): solicitud (campos se llenan con animación cuando el agente llama la herramienta), candidatos (tarjetas sin foto ni estrellas), botón invitar, estado de invitaciones (enviada → aceptada/rechazada), "Cuadrilla 3 de 3".
- Panel derecho: costo legal estimado (desglose), tarifa NIVEL (base + IVA = total), garantía de búsqueda 7 días.
- `/c/obra` — asistencia del día (horas reales, motivo si el trabajador lo agregó), bitácora.
- `/c/pagos` — registrar pago al trabajador (Pago Móvil/transferencia + referencia) → genera recibo `/recibo/[id]`; tarifas de NIVEL con factura simulada; sugerencia de Plan Obra.
- `/c/calificar` — calificación privada por categorías + etiquetas; texto: "Tu calificación es privada y le ayuda a mejorar."

### `/a` Academia
Cursos, inscripciones del mes, ventas, comisión NIVEL 15% + IVA, pruebas prácticas de hoy (evaluar → aprobar/reprobar → actualiza nivel del trabajador), ranking con fórmula visible ("% de alumnos con trabajo a 90 días según datos de NIVEL").

### `/admin`
- `/admin` métricas: trabajadores, solicitudes, tiempo promedio a cuadrilla completa, contrataciones, ingresos (base, IVA aparte), comisiones.
- `/admin/revision` cola de reportes: audio + transcripción + clasificación → resolver/descartar con nota.

### `/demo` Modo Jurado (pantalla de 1920×1080)
- Izquierda: `PhoneFrame` con iframe `/t?demo=1`. Centro‑derecha: iframe `/c`. Los iframes necesitan `allow="microphone; autoplay; geolocation"`. El audio solo arranca tras un toque del usuario: el presentador toca "Habla con Nivi" o el reproductor. Abajo: **bitácora en vivo** (`EventLog`): hora, actor, etiqueta, insignia de producto ("ElevenAgents · crear_solicitud · 820 ms", "TTS · nota de voz · 410 ms", "Scribe v2 · reporte · 1,2 s"). Arriba: contador "Cuadrilla armada en 00:47", botones **Reset demo** y **Avanzar a fin de obra**, interruptores **Bot de demo** y **Plan B**, **QR** a `/t/registro` para el público.
- `/demo/check`: lista verde/roja (claves, token de cada agente, DB, archivos de audio, micrófono, salida de audio).

### Páginas legales
`/legal/terminos`, `/legal/privacidad`, `/legal/niveles` (tabla de la sección 6.1). Cortas, en lenguaje simple.

---

## 10. API (todas devuelven JSON; validar con zod)

Herramientas de agentes (con `x-tool-secret`): `POST /api/tools/{guardar_perfil|crear_reporte|consultar_ofertas|responder_oferta|crear_solicitud|invitar_candidatos|calcular_costo_legal}`

App:
- `GET /api/el/token?agent=worker|contractor`
- `GET /api/state` (persona activa, trabajador activo, solicitud activa) · `POST /api/state`
- `GET /api/requests/active` · `POST /api/requests` (formulario)
- `GET /api/invitations?workerId=` · `POST /api/invitations/:id/respond`
- `POST /api/contracts` · `POST /api/contracts/:id/sign`
- `POST /api/attendance/checkin` · `POST /api/attendance/checkout`
- `POST /api/payments` · `POST /api/payments/:id/confirm`
- `POST /api/ratings` (calcula `revealed_at` cuando ambas partes califican)
- `POST /api/level/recalc/:workerId`
- `POST /api/voice/tts` (texto → URL de audio en caché) · `POST /api/voice/transcribe` (multipart)
- `GET /api/reports` · `POST /api/reports/:id/resolve`
- `GET /api/me/data?workerId=` · `DELETE /api/me?workerId=`
- `GET /api/metrics`
- `GET /api/events?since=` · `POST /api/events`
- `GET /api/workers/by-conversation/:conversationId`
- `POST /api/demo/fast-forward` (asistencia de los días restantes de la obra activa)
- `POST /api/demo/bot` (`on`|`off`)
- `POST /api/demo/reset` (header `x-demo-key`; conserva los registros `is_real`, salvo `?all=1`)

`scripts/smoke.ts` ejecuta en orden: reset → crear_solicitud (debe dar `cumplen = 6`) → invitar_candidatos(3) → Rafael y José aceptan, Luis rechaza → invitar_candidatos(1) invita a Carlos → Carlos acepta → firma → entrada → fast-forward → salida → pago → confirmar → calificar (ambos, se revelan) → recalcular nivel (Carlos debe quedar en 3) → crear_reporte → resolver. Falla con código ≠ 0 si algo no cuadra.

---

## 11. Diseño: identidad visual de Bytes

Los logos y fuentes están en `assets/brand/`. La referencia visual completa de las pantallas está en `reference/` (el HTML y CSS del video demo y fotogramas por escena). **Copia el estilo, no el contenido que contradiga la sección 8.**

Tokens (en `globals.css` con `@theme`):
```
--g:#19510A  --g2:#2C6E1B  --gt:#E6EFE2  --gt2:#CFE0C8      (verde Bytes y tintes)
--ink:#101820 --ink2:#2A333C --mut:#5E6872                  (tinta)
--gray:#D7D7D6 --gray2:#EDEDEC --w:#FFFFFF
--amber:#A86A00 --amberbg:#FFF3D6 --red:#B42318 --redbg:#FDE8E6
```
- Titulares: Inter 900 itálica (sustituye a Helvetica Now Text Black Italic del manual), tracking −1%.
- Texto: Inter 400–700. Etiquetas: mayúsculas, 12–13 px, 700, tracking +8%.
- Tarjetas blancas con borde `--gray`, radio 14 px; acentos en verde; estados: verde (ok), ámbar (pendiente), rojo (alerta).
- Logos: `bytes-h-green.png` (horizontal verde) en fondos claros, `bytes-h-white.png` en fondo `--ink`, `bytes-iso-green.png` como favicon/icono. "NIVEL · por Bytes Technology".
- Orbe de voz: círculo verde con anillos concéntricos que laten con el volumen (eco del isotipo de Bytes).
- Animaciones cortas (150–250 ms). Nada de spinners eternos: estados de carga con texto ("Nivi está buscando soldadores…").
- Accesibilidad: botones de 48 px mínimo en móvil, contraste AA, todo audio con texto al lado.

---

## 12. Robustez para el escenario

- **Plan B (`?planb=1`)**: el orbe reproduce los audios pregenerados de Nivi en el orden del guion y el servidor ejecuta las mismas herramientas (mismo resultado en DB y bitácora). El presentador lo activa si la red falla. Debe verse idéntico al modo real.
- **Reset en 1 clic** que deja la data exactamente como el seed (idempotente, < 3 s) y conserva los registros reales.
- **Timeouts**: 8 s en TTS/STT, 12 s en herramientas; un reintento; mensaje amable si falla.
- **Audio pregenerado** para todo lo del camino dorado. La ruta dinámica de TTS es extra.
- **Preflight** `/demo/check` antes de subir al escenario.
- **Backup local**: `npm run build && npm start` en la laptop con `file:local.db` y túnel opcional; datos móviles del teléfono como respaldo de Wi‑Fi.
- **Probar** en Chrome desktop, Chrome Android y Safari iPhone (micrófono y audio).
- **Plan C:** widget oficial (`?widget=1`), mismas herramientas.
- **Micrófono en el escenario:** el contratista habla con un micrófono de diadema o el de unos audífonos conectado a la laptop; el teléfono del trabajador se usa en modo nota de voz, cerca de la boca. Probar con ruido de fondo (pongan música) antes de subir.
- **Grabar** a H13 un video del camino dorado completo como último recurso.

---

## 13. Plan por horas (H0 = inicio)

Suponiendo 2 personas: **P1 técnico** (guía a Claude Code) y **P2 producto/pitch** (voz, guion, pruebas). Claude Code puede correr 2 sesiones en paralelo con `git worktree` si las carpetas no se pisan (`src/app/t`, `src/app/c`, `src/lib`).

| Hora | Claude Code | Humanos |
|---|---|---|
| H0–H1 | Repo, Next.js, tokens Bytes, Drizzle + Turso, seed, `lib/*` con tests, despliegue en Vercel, skills de ElevenLabs | P1: claves (ElevenLabs, Turso, Vercel). P2: Voice Design "Nivi", contactar a 3–5 trabajadores reales y 1 contratista para probar la app por la tarde, borrador del guion |
| H1–H3 | APIs de herramientas + crear los 2 agentes + `/api/el/token` + `smoke.ts` en verde sin voz | P1 revisa tool calls en el panel de ElevenLabs. P2 prueba hablar con los agentes y ajusta el prompt |
| H3–H5 | `/c` en vivo (pedido por voz, candidatos, invitaciones, costos) + `/t` ofertas, contrato, obra | P2 escribe guiones de lecciones y revisa textos legales en UI |
| H5–H7 | `/t` fin de obra, pago, recibo, calificación, nivel + `/t/registro` por voz + `/demo` con bitácora | Primer ensayo del camino dorado |
| **H7 — corte** | **Camino dorado completo en la URL pública.** Si no está, se recorta P1 y se arregla P0 | Decisión: qué P1 entra |
| H7–H9 | Reporte por voz + `/admin/revision`, "Mis datos", `/a`, calculadora | P2: pruebas en teléfonos reales |
| H9–H11 | `generate-audio.ts` (lecciones, notas, SFX, plan B), voz Nivi en todo, pulido visual | Segundo ensayo cronometrado |
| H11–H12 | Plan B, plan C (widget), preflight, reset, estados de error y carga | Prueba con usuarios reales (sección 7.8) y anotar sus comentarios |
| H12–H13 | **Congelar funciones.** Solo bugs. Grabar video de respaldo | Ensayo 3 + pitch |
| H13–H15 | Bugs críticos únicamente | Ensayos 4–5, preparar equipos, preflight final |

Regla de corte: si a H7 el P0 no está completo, todo P1 se pospone. Si a H11 algo P1 no está estable, se oculta.

---

## 14. Guion de la demo (≈ 4 minutos)

| Tiempo | Quién / pantalla | Qué pasa |
|---|---|---|
| 0:00 | Presentador | "En Carabobo, armar una cuadrilla tarda hasta 3 semanas. Nadie puede probar quién sabe hacer qué." |
| 0:20 | `/demo` → web del contratista | El ingeniero de Constructora Los Guayos habla: *"Necesito 3 soldadores, nivel 2 o más, desde el martes en Los Guayos, 5 días, a 25 dólares diarios."* El tablero se llena solo; la bitácora muestra la herramienta y la latencia. |
| 0:50 | Agente | Lee: 6 cumplen, costo legal estimado, tarifa + IVA. "¿Invito a los 3 mejores?" → "Sí." Rafael y José aceptan; Luis rechaza → "Reemplazo sugerido: Carlos R." → Invitar. |
| 1:10 | Teléfono (Carlos) | Llega la nota de voz de invitación (TTS). Carlos la escucha y acepta. Firma con código. "NIVEL no es el patrono." Contador: "Cuadrilla armada en 00:5x". |
| 1:35 | Teléfono | "Llegué a la obra" → en la web aparece "Llegó 7:02 a. m.". Presentador: "Avanzar a fin de obra". |
| 1:50 | Web → teléfono | Fin de obra: pago registrado por Pago Móvil, recibo art. 106, Carlos confirma, calificaciones privadas → **"¡Subiste a Nivel 3: Probado!"** con sonido y voz. |
| 2:20 | Escenario | Un miembro del equipo (o un jurado) se registra hablando con Nivi en 40 s → perfil + ruta + primera lección en audio. |
| 3:00 | Teléfono → `/admin/revision` | Nota de voz "no había extintor en el área de soldadura" → Scribe la transcribe → cola de revisión humana. "Ninguna máquina castiga a nadie." |
| 3:20 | `/admin` y `/a` | Negocio: tarifa por contratación, Plan Obra, 15% de academias, todo + IVA. Ingresos calculados en vivo. |
| 3:30 | `/demo` | "Hoy, N trabajadores reales de Carabobo ya se registraron hablando con Nivi" (solo si es cierto; cifra real del contador). Cita corta del contratista real si la hay. |
| 3:40 | QR en pantalla | "Escaneen y regístrense con su voz ahora mismo. Sin descargar nada." Cierre: "Contrata rápido y en regla. Voz por ElevenLabs." |

---

## 15. Definición de terminado (antes de subir al escenario)

- [ ] `npm run build` y `npm test` en verde; `npm run smoke` en verde contra producción.
- [ ] Camino dorado completo 3 veces seguidas sin errores en la URL pública.
- [ ] Reset deja todo como el seed en < 3 s.
- [ ] Plan B probado con el Wi‑Fi apagado.
- [ ] `/demo/check` todo verde en la laptop del escenario.
- [ ] Ningún texto prohibido (sección 8.11) en `src/` (`grep -ri`).
- [ ] Ninguna pantalla de empresa muestra estrellas, comentarios, foto, edad ni sexo.
- [ ] Zelle y USDT no aparecen en ninguna parte.
- [ ] Todos los precios dicen "+ IVA".
- [ ] Pie "Demo · nombres, empresas y cifras de ejemplo" visible.
- [ ] Nota de voz (mantén presionado) probada con ruido de fondo en Chrome Android y Safari iPhone.
- [ ] Plan C (widget) probado.
- [ ] Video de respaldo grabado.

---

## 16. Primer mensaje sugerido para Claude Code

> Lee `CLAUDE.md` completo y los archivos de `reference/` y `assets/`. Crea `PROGRESS.md` con tu plan para H0–H3. Luego ejecuta la sección 13, fila H0–H1: inicializa el proyecto, tokens de diseño Bytes, esquema y seed, funciones de `lib/` con tests, y deja un despliegue funcionando. Cuando necesites una clave o un paso en un panel web, escríbelo como "HUMANO:" en `PROGRESS.md` y sigue.

## 17. Archivos de este kit
- `CLAUDE.md` — este documento.
- `assets/brand/` — logos de Bytes (PNG transparentes) y fuentes Inter.
- `reference/app.css`, `reference/demo.html` — sistema visual y pantallas del video demo (contenido anterior a la revisión legal: las estrellas visibles y Zelle/USDT **no** se copian).
- `reference/frames/` — un fotograma por escena del video demo.
- `docs/Revision_Legal_NIVEL_ValenValley.pdf` — revisión legal completa (fuente de la sección 8).
