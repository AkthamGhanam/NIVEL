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

## Fase 11 · Producto web en `/t` y `/c`

- [x] Las apps dejan de verse como presentación y siguen en `/t` (trabajador) y `/c` (contratista);
      `/trabajador` y `/contratista` redirigen ahí. La portada enlaza a cada app
- [x] Trabajador sin marco de teléfono: menú lateral oscuro en escritorio, encabezado y barra inferior en el
      teléfono. El marco queda solo en `/estilo`
- [x] **Sin Modo Jurado**: se quita `/demo`; la demo se presenta directo en `/t` y `/c`. Reiniciar datos (conservando
      o borrando también los registros reales), el bot y "avanzar la obra" pasan a `/admin/datos`
- [x] Acceso del trabajador: crear el perfil **hablando con Nivi** (`@elevenlabs/react`, WebRTC con el token y
      el contexto firmado de `/api/el/token`; la pantalla reclama el perfil por la conversación) o **escribiendo**
      (`POST /api/workers/register`). Las cuentas de prueba quedan plegadas en "¿Vienes a probar NIVEL?"
- [x] Acceso del contratista: **registro de empresa** con RIF validado y normalizado (`POST /api/companies/register`),
      nace sin verificar. Empresas de prueba plegadas igual que en el trabajador
- [x] Todo registro desde la web es real: nace privado, sobrevive al reset y nadie puede entrar como él desde las
      cuentas de prueba. Nueva columna `companies.is_real` (la migración la agrega sola)
- [x] `/api/state` devuelve `activeCompany`, así la web identifica también a una empresa real
- [x] CSP de páginas: `connect-src` admite solo ElevenLabs (API y LiveKit) además del propio origen
- [x] Tope de 20 registros por IP cada 10 minutos
- [x] **Elegir a quién invitar**: cada persona que cumple tiene su casilla; se invita a las elegidas (hasta 10 a
      la vez) o, de un clic, a las mejores. `POST /api/requests/:id/invite` acepta `{ workerIds }` además de
      `{ quantity }`. "Reemplazo sugerido" solo aparece si alguien rechazó

Pendiente:

- La voz de registro solo está probada hasta el token: falta una conversación real con micrófono en el Preview.
- No hay inicio de sesión para volver a una cuenta real desde otro navegador: la sesión vive en la cookie.

## Fase 12 · Voz en las pantallas — en curso

### 12a · Notas de voz — listas (sin probar aún contra ElevenLabs real)

- [x] «Escuchar la oferta» en la tarjeta y en el detalle de la invitación: Nivi lee lo mismo que está escrito
      (empresa, oficio, zona, días, pago diario y total) y recuerda que el contrato es directo con la empresa.
      El audio se pide solo cuando la persona lo toca, y repetir la misma frase sale de la caché del servidor
- [x] Reporte por nota de voz en `/t/ayuda`: hasta 60 s, con reloj, «Terminar y enviar» y «Descartar». La nota
      sube cruda a `/api/voice/transcribe`; la pantalla muestra lo que se entendió y cómo se anotó, y el aviso
      de revisión humana. El formulario escrito queda siempre debajo
- [x] El audio de la nota no se guarda en el navegador ni en el servidor, y el micrófono se suelta al terminar,
      al descartar o al salir de la pantalla
- [x] Solo se reproduce audio servido por la propia app (`src/client/audio-url.ts`)
- [x] 661 pruebas; cobertura de líneas 99 %

Recorrido en Chromium a 390 px con el micrófono falso del navegador: 8 estados, axe sin hallazgos, sin
desbordes y sin errores inesperados. La nota grabada subió de verdad al servidor local (`audio/webm`), que
respondió 503 porque aquí no hay clave de ElevenLabs; el camino feliz en el navegador se vio interceptando
solo las dos rutas de voz. Contra las rutas reales, con ElevenLabs sustituido, lo cubren las pruebas.

Pendiente de las notas de voz:

- Probarlas contra ElevenLabs real (TTS y Scribe) en producción: desde este hilo no hay clave ni acceso.
- Sin probar en Safari (graba en MP4) ni en un teléfono real.
- Sin servicio de voz, el mensaje al fallar es el genérico del servidor («aún no está configurado»).

### 12b · Hablar con Nivi — listo en código (sin probar aún contra ElevenLabs real)

- [x] `NiviVoice`: un componente y tres modos sobre el mismo agente. **Nota de voz** (el micrófono solo se
      abre mientras se mantiene presionado; también con el teclado), **llamada** (manos libres, con «Colgar»)
      y **texto** (sin micrófono). Orbe con su estado en palabras y la conversación escrita en vivo
- [x] El modo elegido se recuerda en el teléfono, por separado para el trabajador y la empresa
- [x] `/c`: tarjeta «Pídela hablando» en modo llamada; lo que el agente crea aparece en el tablero de al lado
- [x] El registro por voz es el de la fase 11 (acceso de `/t`, con `@elevenlabs/react`). Aquí solo se le pasan
      los worklets propios: sin eso el SDK los carga como `blob:`, que la CSP no admite
- [x] SDK `@elevenlabs/client` 1.37.1, la misma versión que trae `@elevenlabs/react`. Sus worklets se sirven
      desde `public/elevenlabs`; una prueba avisa si dejan de coincidir con el paquete
- [x] 690 pruebas; cobertura de líneas 99 %

Recorrido en Chromium (1440 px y 390 px) antes de unir con la fase 11: estados de Nivi y panel de la empresa,
axe sin hallazgos y sin desbordes. Se comprobó en el navegador que el worklet propio carga bajo la CSP real
y que, con un token de mentira, el SDK intenta conectar con ElevenLabs sin chocar con la CSP.

Pendiente de hablar con Nivi:

- **Una conversación real con el agente.** Aquí no hay clave de ElevenLabs: nunca se oyó a Nivi desde estas
  pantallas. Falta probar en producción el registro y el panel de `/c`.
- La pantalla `/t/registro` que traía esta fase (hoja de permiso con audio, tres modos y «Esto entendimos»)
  se quitó al unir con la fase 11, para no tener dos registros por voz. El registro actual solo tiene llamada.
- Si ElevenLabs no conecta, el registro muestra el mensaje técnico del SDK en inglés.
- Sin probar en Safari ni en un teléfono real (el permiso del micrófono cambia entre navegadores).
- El Plan B (`?planb=1`), el widget de respaldo y el chequeo previo siguen pendientes.

## Decisiones

- **Sin Cache Components.** La CSP con nonce exige renderizar cada página por petición, y la demo es en vivo.
- **Kit v2.** Sin WhatsApp ni telefonía: toda la voz dentro de la app (`NiviVoice`), widget oficial como plan C.

## HUMANO

- [x] Proyecto en Vercel conectado al repositorio. Producción: https://nivel-wheat.vercel.app
- HUMANO: confirmar créditos de ElevenLabs (Agents, TTS, STT, Sound Effects).
- HUMANO: crear la base en Turso y poner en Vercel `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `SESSION_SECRET`,
  `DEMO_RESET_KEY` y `TOOL_SECRET` (ver `.env.example`).
- HUMANO: poner en Vercel `NEXT_PUBLIC_APP_URL=https://nivel-wheat.vercel.app`. De esa variable dependen las
  cookies seguras, el QR del Modo Jurado y la dirección a la que llaman las herramientas de los agentes.
- HUMANO: poner `ELEVENLABS_API_KEY` y `EL_VOICE_ID=9Ux14cxOYULytGFBVsW4` en Vercel.
- HUMANO: en elevenlabs.io → Developers → API Keys, darle a la clave los permisos de ElevenAgents (lectura y
  escritura), Sound Effects y, para la voz propia, Voices (escritura) y Voice Generation. Sin ElevenAgents,
  `/api/el/token` falla y no se pueden publicar los agentes.
- HUMANO: con la URL de Vercel lista, correr `npm run agents:setup` (con `NEXT_PUBLIC_APP_URL` y `TOOL_SECRET`
  iguales a los de Vercel), poner en Vercel los `EL_AGENT_*_ID` que imprime y correr `npm run voice:check`.
