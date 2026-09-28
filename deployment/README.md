# Docker

Запуск BoneCheck AI одной командой из корня репозитория.

## Что запускается

```bash
docker compose up --build
```

| Сервис | Откуда собирается | Что делает | Порт |
| --- | --- | --- | --- |
| `frontend` | `frontend/Dockerfile` | веб-интерфейс | 5173 |
| `backend` | `backend/Dockerfile` | API | 3000 |
| `ml-service` | `ml/Dockerfile` | контейнер ML-компонента | 8000 |

Интерфейс стартует после API. Образы интерфейса и API основаны на Node.js 20. Образ ML-компонента — на Python 3.12.

Остановка:

```bash
docker compose down
```

Каталоги с исследованиями при этом не удаляются.

## Порты

| Адрес | Что открыть |
| --- | --- |
| http://localhost:5173 | экран «Проверка исследования» |
| http://localhost:3000/health | `{"status":"ok"}` |
| http://localhost:3000/api/docs | описание API |

Порты можно переопределить переменными `FRONTEND_PORT`, `BACKEND_PORT` и `ML_SERVICE_PORT`.

## Переменные

Шаблон: [.env.example](../.env.example). Compose читает его из корня.

Интерфейс получает `VITE_API_BASE_URL`. По умолчанию это `http://localhost:3000`: браузер на вашей машине обращается к API на порту хоста.

API внутри контейнера получает:

| Переменная | Значение |
| --- | --- |
| `BACKEND_PORT` | `3000` |
| `BACKEND_HOST` | `0.0.0.0` |
| `DATABASE_PATH` | `/app/data/bonecheck.sqlite` |
| `UPLOAD_DIR` | `/app/uploads` |

Путь базы из `.env` в контейнер не подставляется. Так локальный путь Windows не попадает внутрь Linux-контейнера.

## Тома

| На машине | В контейнере | Что хранится |
| --- | --- | --- |
| `backend/data` | `/app/data` | файл метаданных исследований |
| `backend/uploads` | `/app/uploads` | загруженные DICOM |

Оба каталога переживают `docker compose down` и следующий `up`.

## Проверка

1. Дождитесь, пока сборка закончится и сервисы останутся запущенными.
2. Откройте http://localhost:5173.
3. Откройте http://localhost:3000/health и убедитесь, что ответ `{"status":"ok"}`.
4. Загрузите DICOM или ZIP. Запись должна появиться в «Истории».
5. Файл исследования должен остаться в `backend/uploads`, метаданные — в `backend/data`.

Если порт 5173 или 3000 занят, задайте другой порт в `.env` и запустите Compose снова.
