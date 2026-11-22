# Progreso de NIVEL

Plan aprobado: https://claude.ai/artifact/GSnQHsdYHduT8bpe6sQPD2 (backend fases 0–5, frontend 6–10).

## Fase 0 · Cimientos — en curso

- [x] Next.js 16.4.6 + TypeScript estricto (`noUncheckedIndexedAccess`, `noImplicitReturns`)
- [x] ESLint sin avisos, Prettier, Vitest con umbral de cobertura
- [x] Cabeceras de seguridad y CSP con nonce, verificadas en `next start` con Chromium (0 errores de consola)
- [x] Entorno validado con zod (`src/server/config/env.ts`)
- [x] `GET /api/health`
- [x] CI de GitHub Actions y Dependabot
- [ ] CI en verde en GitHub
- [ ] Despliegue en Vercel con `/api/health` en 200

## Decisiones

- **Sin Cache Components.** La CSP con nonce exige renderizar cada página por petición, y la demo es en vivo.
- **Kit v2.** Sin WhatsApp ni telefonía: toda la voz dentro de la app (`NiviVoice`), widget oficial como plan C.

## HUMANO

- HUMANO: crear el repositorio vacío `nivel` en GitHub (sin README) y avisar.
- HUMANO: crear el proyecto en Vercel conectado a ese repositorio.
- HUMANO: confirmar créditos de ElevenLabs (Agents, TTS, STT, Sound Effects).
