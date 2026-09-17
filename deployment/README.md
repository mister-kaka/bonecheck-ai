# Deployment

Каркас развёртывания. Боевой Kubernetes/CI не настраивается на этом этапе.

## Локально

Из корня репозитория:

```bash
docker compose up --build
```

Сервисы описаны в корневом `docker-compose.yml`:

- `frontend` — Vite dev server;
- `backend` — NestJS;
- `ml-service` — Python placeholder.

## Переменные

Шаблон: `../.env.example`.

## Дальнейшие шаги (не реализовано)

- production-сборка frontend (`vite build` + nginx);
- отдельный stage для backend (`npm run build` + `node dist/main`);
- HTTP inference в ML-контейнере и volume с весами модели вне git.
