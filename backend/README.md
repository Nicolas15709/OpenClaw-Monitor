# OpenClaw Monitor API

Backend separado y endurecido para telemetría real de OpenClaw.

## Seguridad inicial

- Fastify
- SQLite local
- Password hashing con Argon2id
- Cookies HttpOnly + SameSite=Strict
- CORS cerrado a un origen permitido
- Rate limiting
- Helmet
- Telemetría sanitizada
- Sin secretos expuestos en respuesta

## Endpoints

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /api/telemetry/snapshot` (auth requerida)
- `GET /health`

## Arranque

```bash
cd apps/openclaw-monitor-api
cp .env.example .env
npm install
npm run seed-admin
npm run dev
```

## Nota

Esta primera versión devuelve una snapshot sanitizada del estado de OpenClaw.
El siguiente paso es añadir telemetría estructurada de sesiones, cron, tokens y actividad actual.
