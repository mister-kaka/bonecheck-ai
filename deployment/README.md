# Docker

Запуск BoneCheck AI одной командой из корня репозитория.

Оглавление: [../docs/README.md](../docs/README.md).

## Что запускается

```bash
docker compose up --build
```

| Сервис | Откуда собирается | Что делает | Порт хоста | Порт в контейнере |
| --- | --- | --- | --- | --- |
| `frontend` | `frontend/Dockerfile` | веб-интерфейс | `FRONTEND_PORT`, по умолчанию 5173 | 5173 |
| `backend` | `backend/Dockerfile` | API | `BACKEND_PORT`, по умолчанию 3000 | 3000 |
| `ml-service` | `ml/Dockerfile` | `site_prediction`, модели один раз при старте | `ML_SERVICE_PORT`, по умолчанию 8000 | 8000 |

Интерфейс стартует после API. Образы интерфейса и API основаны на Node.js 20. Образ `ml-service` основан на Python 3.12.

Остановка:

```bash
docker compose down
```

Каталоги с исследованиями при этом не удаляются.

## Порты

| Адрес | Что открыть |
| --- | --- |
| http://localhost:5173 | экран «Проверка исследования» |
| http://localhost:3000 | API |
| http://localhost:3000/health | `{"status":"ok"}` |
| http://localhost:3000/api/docs | описание API |

Это порты хоста при значениях по умолчанию. Внутри контейнеров процессы слушают 5173 и 3000. Браузер ходит в API по `VITE_API_BASE_URL` (`http://localhost:3000`), то есть на порт хоста, а не на имя сервиса в сети Compose.

Порт 8000 опубликован для `ml-service`. Его открывает API внутри сети Compose (`http://ml-service:8000`), не браузер. `GET /health` отвечает после загрузки моделей. Каталог `backend/uploads` смонтирован в API и в ML по пути `/app/uploads`.

## Переменные

Шаблон: [.env.example](../.env.example). Compose читает его из корня.

Интерфейс получает `VITE_API_BASE_URL`. По умолчанию это `http://localhost:3000`: браузер на вашей машине обращается к API на порту хоста.

API внутри контейнера получает:

| Переменная | Значение |
| --- | --- |
| `BACKEND_PORT` | `3000` |
| `BACKEND_HOST` | `0.0.0.0` |
| `DATABASE_PATH` | `/app/data/bonecheck-docker.sqlite` |
| `UPLOAD_DIR` | `/app/uploads` |
| `ML_SERVICE_URL` | `http://ml-service:8000` |
| `ML_TIMEOUT_MS` | `180000` |
| `SQLITE_JOURNAL_MODE` | `DELETE`. На bind-mount Docker Desktop режим WAL не создаёт `-shm` и API не стартует |

Путь базы из `.env` в контейнер не подставляется. Так локальный путь Windows не попадает внутрь Linux-контейнера.

## Где хранятся данные

| На машине | В контейнере | Что хранится |
| --- | --- | --- |
| `backend/data` | `/app/data` | файл метаданных исследований |
| `backend/uploads` | `/app/uploads` в API и в ML | загруженные DICOM и `heatmap.png` |

Оба каталога переживают `docker compose down` и следующий `up`.

## Проверка

1. Дождитесь, пока сборка закончится и сервисы останутся запущенными.
2. Откройте http://localhost:5173.
3. Откройте http://localhost:3000/health и убедитесь, что ответ `{"status":"ok"}`.
4. Загрузите DICOM или ZIP. Запись должна появиться в «Истории».
5. Файл исследования должен остаться в `backend/uploads`, метаданные - в `backend/data`.

Если порт 5173 занят, задайте другой `FRONTEND_PORT` и откройте интерфейс на этом порту хоста.

Если порт 3000 занят, задайте другой `BACKEND_PORT` и тот же адрес в `VITE_API_BASE_URL`, например `http://localhost:3001`. Иначе браузер продолжит вызывать http://localhost:3000. Внутри контейнера API по-прежнему слушает 3000.

После смены `.env` запустите Compose снова. Порт 8000 для работы интерфейса менять не нужно.
