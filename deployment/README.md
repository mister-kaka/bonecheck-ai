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
| `backend` | `backend/Dockerfile` | `npm run start:dev` | 3000 |
| `ml-service` | `ml/Dockerfile` | `python src/app.py` | 8000 на хосте |

`frontend` зависит от `backend`. `backend` **не** зависит от `ml-service` и не передаёт в него запросы.

Переменные Compose: шаблон [../.env.example](../.env.example).

Backend в Compose получает только `BACKEND_PORT` и `BACKEND_HOST`. `UPLOAD_DIR` внутри контейнера будет дефолтным (`./uploads` в `/app`), volume для загрузок не объявлен.

## Переменные (.env.example)

Используются кодом или Compose:

- `BACKEND_PORT`, `BACKEND_HOST`
- `FRONTEND_PORT`, `VITE_API_BASE_URL`
- `ML_SERVICE_PORT`
- `UPLOAD_DIR`, `ML_MOCK_DELAY_MS`

Не используются кодом, только комментарий/намерение:

- `MAX_FILE_SIZE_BYTES` (лимит зашит в backend как 50 МБ);
- `DATABASE_URL` (PostgreSQL не подключена).

## PLANNED (не реализовано)

- production-сборка frontend (`vite build` + nginx);
- production backend (`npm run build` + `node dist/main`);
- HTTP inference в ML-контейнере;
- volume с весами и с DICOM между backend и ML;
- PostgreSQL в Compose.
