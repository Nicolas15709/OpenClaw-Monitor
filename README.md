# OpenClaw-Monitor

Monitor seguro para OpenClaw con frontend + backend separados.

## Estructura

- `frontend/` → UI del monitor
- `backend/` → API segura de telemetría

## Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Backend

```bash
cd backend
cp .env.example .env
npm install
npm run seed-admin
npm run dev
```

## Operabilidad añadida en backend

- `GET /health` → estado estructurado del backend + OpenClaw CLI + DB
- `GET /health/ready` → readiness probe, responde `503` si el sistema está degradado/offline
- Health checks reales contra SQLite y comandos `openclaw`
- Degradación parcial: si falla una parte de la telemetría, el snapshot sigue devolviendo lo que sí está disponible
- Limpieza automática de sesiones expiradas al arrancar
- Warnings de arranque cuando se usa secret por defecto o cookies inseguras
- Smoke test local con `cd backend && npm run smoke`

## Seguridad base

- login con auth local
- contraseña hasheada con Argon2id
- cookie HttpOnly / SameSite=Strict
- SQLite local
- CORS restringido
- Helmet
- rate limiting
- telemetría sanitizada

## Nota

No subir `.env`, `data/` ni `node_modules/`.
