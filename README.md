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
