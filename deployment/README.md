# Deployment

Каркас развёртывания. Kubernetes / CI на этом этапе нет.

## Локально (Compose)

Из корня репозитория:

```bash
docker compose up --build
```

Сервисы в `docker-compose.yml`:

| Сервис | Образ собирается из | Команда в контейнере | Порт |
| --- | --- | --- | --- |
| `frontend` | `frontend/Dockerfile` | `npm run dev` (Vite) | 5173 |
| `backend` | `backend/Dockerfile` (`node:20-alpine`, сборка `better-sqlite3`) | `npm run start:dev` | 3000 |
| `ml-service` | `ml/Dockerfile` | `python src/app.py` | 8000 на хосте |

`frontend` зависит от `backend`. `backend` **не** зависит от `ml-service` и не передаёт в него запросы.

Переменные Compose: шаблон [../.env.example](../.env.example).

Backend в Compose получает `BACKEND_PORT`, `BACKEND_HOST`, `DATABASE_PATH=/app/data/bonecheck.sqlite` и `UPLOAD_DIR=/app/uploads`.

Volumes:

- `./backend/data:/app/data` — файл SQLite переживает `docker compose down` и новый `up`;
- `./backend/uploads:/app/uploads` — загруженные DICOM.

## Переменные (.env.example)

Используются кодом или Compose:

- `BACKEND_PORT`, `BACKEND_HOST`
- `FRONTEND_PORT`, `VITE_API_BASE_URL`
- `ML_SERVICE_PORT`
- `UPLOAD_DIR`, `DATABASE_PATH`, `ML_MOCK_DELAY_MS`

Не используются кодом, только комментарий/намерение:

- `MAX_FILE_SIZE_BYTES` (лимит зашит в backend как 50 МБ).

`DATABASE_PATH` в `.env.example` — путь для локального `npm start` из `backend/`. В контейнере Compose задаёт свой абсолютный путь `/app/data/bonecheck.sqlite`, чтобы Windows-путь из `.env` не попал внутрь контейнера.

## PLANNED (не реализовано)

- production-сборка frontend (`vite build` + nginx);
- production backend (`npm run build` + `node dist/main`);
- HTTP inference в ML-контейнере;
- volume с весами между backend и ML.
