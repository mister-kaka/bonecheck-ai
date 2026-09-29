# Запуск

Инструкция для человека, который скачал репозиторий и хочет открыть BoneCheck AI.

Оглавление: [README.md](../README.md).

## Требования

Локальный запуск:

- Node.js 20;
- npm;
- Python 3.12 и pip, как в образе `ml-service`.

Запуск через Docker:

- Docker;
- Docker Compose.

Команды ниже выполняются из корня репозитория `bonecheck-ai`, если не сказано иное.

Целевая конфигурация финального теста организатора: 2 × H200 141 GB, flavor GPU-44-256-H200-1 (44 CPU, 256 GB RAM, 141 GB VRAM). Время на этой конфигурации в репозитории не измерено.

Образ `ml-service` ставит CPU-сборки PyTorch из `ml/requirements.txt`. Видеокарта, в том числе H200, этим образом не используется и в Compose не пробрасывается.

Наблюдение локального Docker на CPU, не на H200, 29.09.2026: после загрузки весов контейнер `ml-service` занимал около 2,8 ГиБ. Тёплый разбор поясничного снимка занял около 2 с, проксимального бедра - около 8 с. Файлы весов на диске - около 640 МБ. Отдельный подбор минимума не проводился. Для этого образа нужен CPU, оперативная память с запасом над этими 2,8 ГиБ и место под образ Docker, веса и загруженные DICOM. API и интерфейс к объёму ML добавляются отдельно.

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
| `BACKEND_PORT` | порт API на хосте. Локально без этой переменной API слушает 3000; если она задана в окружении процесса, слушает её. В Docker это левая часть проброса на порт 3000 внутри контейнера | `3000` |
| `BACKEND_HOST` | адрес, на котором слушает API | `0.0.0.0` |
| `FRONTEND_PORT` | порт интерфейса на хосте в Docker: левая часть проброса на порт 5173 внутри контейнера. Локальный `npm run dev` всегда слушает 5173 | `5173` |
| `VITE_API_BASE_URL` | адрес API, который вызывает браузер. Должен совпадать с портом API на хосте | `http://localhost:3000` |
| `ML_SERVICE_PORT` | порт хоста в пробросе на порт 8000 контейнера `ml-service`. Браузер его не открывает | `8000` |
| `ML_SERVICE_URL` | адрес inference для API вне Docker | `http://127.0.0.1:8000` |
| `ML_TIMEOUT_MS` | таймаут одного анализа | `180000` |
| `UPLOAD_DIR` | каталог DICOM при локальном запуске API | `./uploads` |
| `DATABASE_PATH` | файл метаданных при локальном запуске API | `./data/bonecheck.sqlite` |

Пути `UPLOAD_DIR` и `DATABASE_PATH` считаются от каталога, из которого запущена команда API. При `npm run start:dev` из `backend/` это `backend/uploads` и `backend/data/bonecheck.sqlite`.

В Docker Compose пути внутри контейнера заданы отдельно: `/app/uploads` и `/app/data/bonecheck-docker.sqlite`. Каталоги на машине - `backend/uploads` и `backend/data`. Файл Docker не совпадает с локальным `bonecheck.sqlite`: тот уже в режиме WAL, а bind-mount Docker Desktop не открывает его `-shm`.

Лимит 50 МБ задан в API, отдельной переменной его нет.

## Локальный запуск

Три терминала. Сначала ML, затем API и интерфейс.

ML, из каталога `ml/`. Зависимости ставятся из `requirements.txt`, веса уже лежат в `ml/models/`:

```bash
cd ml
pip install -r requirements.txt
mkdir -p ../backend/uploads
export PYTHONPATH=src
export UPLOAD_DIR="$(cd ../backend/uploads && pwd)"
python -m inference.server
```

В PowerShell:

```powershell
cd ml
pip install -r requirements.txt
New-Item -ItemType Directory -Force -Path ..\backend\uploads | Out-Null
$env:PYTHONPATH = "src"
$env:UPLOAD_DIR = (Resolve-Path ..\backend\uploads).Path
python -m inference.server
```

`UPLOAD_DIR` должен совпадать с каталогом, куда API пишет DICOM. Без него процесс ML не стартует: так нельзя передать произвольный путь к файлу. Процесс остаётся запущенным. `GET http://127.0.0.1:8000/health` отвечает `{"status":"ok"}` после загрузки моделей.

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

Остановка - `Ctrl+C` в каждом терминале. Если ML не запущен, API не падает: конкретное исследование получает статус «Ошибка анализа».

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

Поднимаются интерфейс, API и долгоживущий `ml-service`. API ждёт, пока ML ответит на проверку здоровья. Общий каталог загрузок - `backend/uploads`, внутри контейнеров это `/app/uploads`. Веса - `ml/models`, внутри ML это `/app/models`.

| Что открыть | Адрес |
| --- | --- |
| Интерфейс | http://localhost:5173 |
| Проверка API | http://localhost:3000/health |
| Описание API | http://localhost:3000/api/docs |

Проброс: хост → контейнер. По умолчанию `5173 → 5173` у интерфейса, `3000 → 3000` у API, `8000 → 8000` у `ml-service`. Внутри контейнера API слушает 3000 и вызывает `http://ml-service:8000`. Интерфейс слушает 5173. Порт 8000 в браузере не открывают.

Остановка:

```bash
docker compose down
```

Состав сервисов, порты и каталоги с данными: [deployment/README.md](../../deployment/README.md).

## Данные между запусками

История и загруженные DICOM сохраняются. После `docker compose down` каталоги `backend/data` и `backend/uploads` остаются.

Пустая история локального API: остановить API и удалить `backend/data/bonecheck.sqlite`. Рядом могут лежать `bonecheck.sqlite-wal` и `bonecheck.sqlite-shm`, их тоже удаляют. Для Docker удаляют `backend/data/bonecheck-docker.sqlite`. Каталог `backend/uploads` очищается отдельно.

Дальше: [тестирование](testing.md).
