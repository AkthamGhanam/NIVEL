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

## Fase 5b · Audio y transcripción — pendiente (necesita `ELEVENLABS_API_KEY`)

- [ ] `POST /api/voice/tts` con caché por texto, `POST /api/voice/transcribe` (Scribe) y sus guiones de audio
- [ ] `scripts/setup-agents.ts` para publicar los dos agentes y confirmar la variable secreta en la cabecera

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

## Fase 7 · Vista del contratista (`/c`) — lista (la voz llega en la fase 8)

- [x] Entrada de la demo: se elige una empresa de ejemplo y el servidor abre la sesión; encabezado con
      nombre, verificación y RIF
- [x] `/c`: formulario para pedir personal, tablero en vivo (se consulta cada 2 s), candidatos sin foto ni
      estrellas, invitaciones con su estado, reemplazo sugerido a un clic y "Cuadrilla completa · 3 de 3"
- [x] Panel de costos: costo legal estimado con su desglose, tarifa de NIVEL con el IVA aparte y garantía de
      búsqueda
- [x] `/c/obra`: asistencia con las horas reales, días cumplidos y bitácora
- [x] `/c/pagos`: registro del pago directo al trabajador, recibo imprimible en `/recibo/[id]`
      (LOTTT art. 106), tarifas de NIVEL con factura simulada y sugerencia del Plan Obra
- [x] `/c/calificar`: calificación privada por categorías del 1 al 5 y etiquetas, sin estrellas
- [x] Una prueba recorre toda la vista contra las rutas reales (misma cookie y mismo control de origen que
      el navegador) y pinta cada paso con lo que devolvió el servidor
- [x] 483 pruebas; cobertura de líneas 99 %

Recorrido completo en un navegador real (Chromium, 1440 px y 390 px) sobre el servidor de producción, con
Carlos respondiendo por API y el bot de demo activo: 13 estados de pantalla, axe sin hallazgos WCAG 2.1 A y
AA, sin desbordes, objetivos táctiles de 44 px o más y cero errores de consola. Otra empresa recibe un 403
al abrir un recibo ajeno. Esa revisión se corre a mano; todavía no está en CI.

Pendiente de esta vista:

- El panel "Pide tu cuadrilla hablando" (orbe y transcripción) llega con `NiviVoice` en la fase 8. El tablero
  ya se actualiza solo cuando el agente crea la solicitud, porque consulta al servidor.
- Sin probar en Safari ni en un teléfono real.

## Fase 8 · App del trabajador (`/t`) — lista sin la voz (falta `ELEVENLABS_API_KEY`)

- [x] Entrada de la demo: marco de teléfono en pantallas grandes y pantalla completa en un teléfono; el
      selector pone primero a los protagonistas (Carlos, Rafael, José, Luis, Andrés)
- [x] `/t`: nivel con lo que falta para el siguiente, interruptor "Abierto a trabajar", el trabajo en curso
      con su siguiente paso y las ofertas, que llegan solas (se consulta cada 3 s)
- [x] `/t/oferta/[id]`: empresa, verificación, puntualidad de pago, trabajo y pago; aceptar o rechazar
- [x] `/t/contrato/[id]`: resumen del contrato directo y firma con código de un solo uso (SMS simulado)
- [x] `/t/obra`: "Llegué a la obra" y "Marcar mi salida" con la ubicación pedida solo al tocar el botón;
      "Simular que estoy en la obra" existe solo con `?demo=1` y si el servidor lo permite
- [x] `/t/fin/[contractId]`: "¿Recibiste tu pago?" con el recibo, salida a Ayuda si no llegó, y calificación
      privada a la empresa; al terminar se recalcula el nivel y se celebra en `/t/nivel?subiste=1`
- [x] `/t/nivel`, `/t/aprender` (cursos con el IVA aparte, lecciones, constancias y prueba práctica),
      `/t/ayuda` (reporte que siempre va a revisión humana)
- [x] `/t/mis-datos`: ver, corregir, descargar y borrar; los cinco permisos, cada uno con su interruptor; y
      las calificaciones privadas recibidas
- [x] Una prueba recorre el camino dorado de Carlos contra las rutas reales, y otra vigila que ninguna
      página del servidor llame funciones de un módulo de cliente
- [x] 529 pruebas; cobertura de líneas 99 %

Cambios en el servidor que salieron de esta fase:

- Retirar el permiso "mostrar mi perfil" saca de las búsquedas a cualquier persona, también a las de
  ejemplo. Antes solo valía para las personas reales.
- El contrato dice si quien lo consulta ya envió su calificación (`ratedByMe`).
- El aviso de fecha al marcar entrada se lee "La obra empieza el mar 24 nov.".

Recorrido completo en un navegador real (Chromium, 390 px y 1440 px) sobre el servidor de producción, con
la empresa actuando por API: 24 estados de pantalla, axe sin hallazgos WCAG 2.1 A y AA, sin desbordes,
objetivos táctiles de 44 px o más y cero errores de consola. Sin permiso de ubicación la app lo explica y
no marca. Fuera del Modo Jurado no aparece el botón de simular. Al borrar la cuenta se cierra la sesión.
Esa revisión se corre a mano; todavía no está en CI. Encontró tres fallos que las pruebas no veían y ya
están corregidos: una página que no abría (`/t/ayuda`), el aviso "Guardamos tus cambios" que se perdía y
contenido fuera de las regiones de la página.

Pendiente de esta app:

- Todo lo que usa ElevenLabs: `NiviVoice` (hablar con Nivi), `/t/registro` por voz con "Prefiero escribir",
  nota de voz de las ofertas, reporte por nota de voz y el sonido al subir de nivel. Tampoco existe todavía
  un registro por formulario: hoy solo se entra como persona de ejemplo.
- Si se borra o se reinicia la demo con una sesión abierta de una persona que ya no existe, el inicio
  muestra un aviso de error hasta tocar "cambiar".
- La ubicación real no se pudo probar en un teléfono dentro de la obra: solo el rechazo sin permiso, y en
  pruebas del servidor las posiciones dentro y fuera de la geocerca.
- Sin probar en Safari ni en un teléfono real.

## Fase 9 · Modo Jurado (`/demo`) — listo sin la voz, el Plan B ni el chequeo previo

- [x] Solo entra el equipo: la página pide la clave de la demo y abre una sesión firmada; la bitácora y los
      controles responden 401 sin ella
- [x] Pantalla dividida: la app del trabajador en un marco de teléfono y la web del contratista al lado, cada
      una en su propio marco del mismo origen, con sesiones separadas
- [x] Bitácora en vivo (se consulta cada 1,5 s, lo más reciente arriba) con quién, qué, a qué hora y, cuando
      el servidor lo registra, el producto de ElevenLabs y la latencia
- [x] Contador de la cuadrilla: corre desde que se publica la solicitud y se detiene con el evento
      "Cuadrilla completa", que el servidor registra una sola vez con los segundos que tardó
- [x] Controles del presentador: "Avanzar a fin de obra", "Reiniciar demo" con confirmación (recarga los dos
      marcos) e interruptor del bot de demo
- [x] Perfiles reales creados hoy (nombre de pila, oficio y zona) y QR dibujado en la propia página, sin
      servicios externos
- [x] En pantallas de 1280 px o más de ancho todo cabe sin desplazar la página: la bitácora va en una
      columna a la derecha y se desplaza por dentro. En pantallas más angostas la página se desplaza
- [x] 561 pruebas; cobertura de líneas 99 %

Recorrido completo en un navegador real (Chromium, 1920 × 1080, 1366 × 768 y 390 px) sobre el servidor de
producción: clave equivocada, entrada, cuadrilla armada con el bot (9 s en el contador), avance a fin de
obra, bot apagado y reinicio. 18 estados con axe sin hallazgos WCAG 2.1 A y AA, sin desbordes y cero errores
de consola. También se midió en 1280 × 720 y 1536 × 864. Esa revisión se corre a mano; no está en CI. Encontró
dos fallos que las pruebas no veían y ya están corregidos: un rol de accesibilidad mal puesto en la bitácora
y la página que crecía con la bitácora hasta sacarla de la pantalla.

Pendiente de esta vista:

- El QR lleva a `/t` (entrada con personas de ejemplo). Apuntará a `/t/registro` cuando exista el registro.
- Interruptor de Plan B (`?planb=1`, audios pregrabados) y chequeo previo `/demo/check`: dependen de la voz.
- La bitácora todavía no muestra eventos de ElevenLabs con latencia real: no hay ninguno hasta integrar la voz.
- En 1280 × 720 el teléfono queda con 440 px de alto útil; funciona, pero hay que desplazar dentro del marco.
- Sin probar en Safari ni en un proyector real.

## Fase 10 · Academia (`/a`) y administración (`/admin`) — listas sin el audio de los reportes

- [x] `/a`: se entra como una academia de ejemplo. Pruebas prácticas por evaluar (la nota la decide la
      academia, el servidor dice si aprueba y recalcula el nivel), constancias por emitir, inscripciones y
      ventas del mes, comisión de NIVEL del 15 % con el IVA aparte, cursos y el ranking con su cuenta y su
      fórmula a la vista
- [x] `/admin`: solo con la clave del equipo. Trabajadores, solicitudes, contrataciones, tiempo promedio a
      cuadrilla completa, reportes en revisión, ingresos por origen (tarifa, IVA y total) y gente por nivel.
      Se recalcula cada 5 s
- [x] `/admin/revision`: cola de reportes de la más antigua a la más nueva, con lo que dijo la persona, la
      empresa señalada, cuánto queda del plazo de 24 h y la decisión (resolver o descartar) con nota
      obligatoria. La pantalla no muestra quién reportó
- [x] La regla de la prueba práctica (3 de cada 4 criterios) vive en `src/lib/practical-test.ts`: la usan el
      servidor, que decide, y el panel, que la explica
- [x] 606 pruebas; cobertura de líneas 99 %

Recorrido completo en un navegador real (Chromium, 1440 px y 390 px) sobre el servidor de producción, con un
trabajador reportando por API: 18 estados de pantalla, axe sin hallazgos WCAG 2.1 A y AA, sin desbordes,
objetivos táctiles de 44 px o más y cero errores de consola. Esa revisión se corre a mano; no está en CI.
Encontró dos fallos que las pruebas no veían y ya están corregidos: un enlace demasiado pequeño para el dedo
y una tabla que en el teléfono no se podía desplazar con el teclado.

Pendiente de estas vistas:

- El audio de un reporte por nota de voz: la cola ya lo reproduce si el reporte trae un archivo de la propia
  app, pero ningún reporte lo trae hasta integrar la voz. Solo está probado con datos de prueba.
- La cola solo muestra los casos abiertos: no hay historial de los ya decididos.
- La academia no registra inscripciones ni cobra cuotas desde su panel: el alumno se inscribe en su app.
- Sin probar en Safari ni en un teléfono real.

## Decisiones

- **Sin Cache Components.** La CSP con nonce exige renderizar cada página por petición, y la demo es en vivo.
- **Kit v2.** Sin WhatsApp ni telefonía: toda la voz dentro de la app (`NiviVoice`), widget oficial como plan C.

## HUMANO

- HUMANO: crear el proyecto en Vercel conectado a ese repositorio.
- HUMANO: confirmar créditos de ElevenLabs (Agents, TTS, STT, Sound Effects).
- HUMANO: crear la base en Turso y poner en Vercel `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `SESSION_SECRET`,
  `DEMO_RESET_KEY`, `TOOL_SECRET` y `NEXT_PUBLIC_APP_URL` (ver `.env.example`).
- HUMANO: poner `ELEVENLABS_API_KEY` en Vercel y en el entorno de trabajo para publicar los agentes (fase 5).
