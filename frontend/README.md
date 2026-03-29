# OpenClaw Monitor

App separada para observar actividad de OpenClaw sin tocar MissionControl.

## Objetivo

Mostrar en tiempo real:
- sesiones activas
- tareas y subtareas
- cron jobs
- timeline de eventos
- logs visibles
- tokens consumidos
- errores y estado general

## Estado actual

Primera versión UI con datos mock.

## Arranque

```bash
cd apps/openclaw-monitor
npm install
npm run dev
```

Dev server por defecto: `http://127.0.0.1:4174`

## Próximo paso

Conectar esta UI a una fuente real de telemetría OpenClaw (snapshot/API/WebSocket) sin tocar el proyecto MissionControl.

# OpenClaw-Monitor
