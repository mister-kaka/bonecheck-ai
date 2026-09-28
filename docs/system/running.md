# Запуск

Инструкция для человека, который скачал репозиторий и хочет открыть BoneCheck AI.

Оглавление: [README.md](../README.md).

## Требования

Локальный запуск:

- Node.js 20;
- npm.

Запуск через Docker:

- Docker;
- Docker Compose.

Команды ниже выполняются из корня репозитория `bonecheck-ai`, если не сказано иное.

## Настройка

Скопируйте пример окружения:

```powershell
Copy-Item .env.example .env
```

```bash
cp .env.example .env
```

| Переменная | Зачем | Значение в примере |
| --- | --- | --- |
| `BACKEND_PORT` | порт API | `3000` |
| `BACKEND_HOST` | адрес, на котором слушает API | `0.0.0.0` |
| `FRONTEND_PORT` | порт интерфейса в Docker | `5173` |
| `VITE_API_BASE_URL` | адрес API для интерфейса | `http://localhost:3000` |
| `ML_SERVICE_PORT` | порт контейнера `ml-service` в Docker | `8000` |
| `UPLOAD_DIR` | каталог DICOM при локальном запуске API | `./uploads` |
| `DATABASE_PATH` | файл метаданных при локальном запуске API | `./data/bonecheck.sqlite` |

Пути `UPLOAD_DIR` и `DATABASE_PATH` считаются от каталога, из которого запущена команда API. При `npm run start:dev` из `backend/` это `backend/uploads` и `backend/data/bonecheck.sqlite`.

В Docker Compose пути внутри контейнера заданы отдельно: `/app/uploads` и `/app/data/bonecheck.sqlite`. Каталоги на машине - `backend/uploads` и `backend/data`.

Лимит 50 МБ задан в API, отдельной переменной его нет.

## Локальный запуск

Два терминала.

API:

```bash
cd backend
npm install
npm run start:dev
```

Интерфейс:

```bash
cd frontend
npm install
npm run dev
```

API перезапускается при изменении кода. Интерфейс открывается на http://localhost:5173.

Остановка - `Ctrl+C` в каждом терминале.

## Проверка

1. Откройте http://localhost:5173. Должен открыться экран «Проверка исследования».
2. Откройте http://localhost:3000/health. Ответ: `{"status":"ok"}`.
3. Откройте http://localhost:3000/api/docs. Там методы API.
4. Загрузите один DICOM или ZIP и дождитесь результата либо записи в «Истории».

Если интерфейс пишет «Не удалось связаться с сервером», API не запущен или `VITE_API_BASE_URL` указывает на другой адрес. После смены этой переменной интерфейс нужно запустить снова.

## Сборка

Интерфейс:

```bash
cd frontend
npm run build
npm run preview
```

`npm run build` проверяет TypeScript и собирает интерфейс. `npm run preview` открывает сборку на порту 5173.

API:

```bash
cd backend
npm run build
npm run start:prod
```

`npm run start:prod` запускает собранный API. Перед этим нужен `npm run build`.

## Docker

Из корня репозитория:

```bash
docker compose up --build
```

Поднимаются интерфейс, API и контейнер `ml-service`. Интерфейс: http://localhost:5173. Проверка API: http://localhost:3000/health.

Остановка:

```bash
docker compose down
```

Состав сервисов, порты и тома: [../deployment/README.md](../../deployment/README.md).

## Данные между запусками

История и загруженные DICOM сохраняются. После `docker compose down` каталоги `backend/data` и `backend/uploads` остаются.

Пустая история: остановить API и удалить `backend/data/bonecheck.sqlite`. Рядом могут лежать `bonecheck.sqlite-wal` и `bonecheck.sqlite-shm`, их тоже удаляют. Каталог `backend/uploads` очищается отдельно.

Дальше: [тестирование](testing.md).
