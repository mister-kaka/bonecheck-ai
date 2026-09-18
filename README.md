# BoneCheck AI (RUEN)

AI-сервис оценки качества денситометрических исследований (DXA / DICOM CR).

Репозиторий: https://github.com/mister-kaka/bonecheck-ai

Хакатон ЛЦТ 2026, направление «Город», постановщик - Департамент здравоохранения Москвы / Центр диагностики и телемедицины.

Документация описывает **состояние репозитория на текущий момент**, а не финальную сдачу.

---

## О проекте

**BoneCheck AI** (в коде и Swagger также **RUEN**) оценивает **качество укладки** исследования плотности костей. Сервис **не** ставит клинический диагноз.

| | |
| --- | --- |
| Вход | один DICOM-файл (`.dcm` / `.dicom`) |
| Что делает система | принимает файл, сохраняет его, запускает анализ, отдаёт статус и результат |
| Результат | `quality_class`, `violation_type`, опционально `quality_prob` и `anatomical_region` |

Сейчас анализ выполняет **mock ML** внутри backend. Реальная модель ещё не подключена.

---

## Текущий статус

Дата фиксации: 2026-09-18.

| Слой | Статус | Что есть в репозитории |
| --- | --- | --- |
| Backend | CONFIRMED, работает | NestJS REST: health, загрузка DICOM, статус, результат, Swagger, mock ML, файлы на диске, in-memory метаданные |
| Frontend | CONFIRMED, заглушка | React + Vite, страница-заголовок, `API_BASE_URL` без вызовов API |
| ML | CONFIRMED, каркас | Python-процесс-заглушка, пустые пакеты, Docker-контейнер без HTTP и без модели |
| Docker | CONFIRMED | `docker-compose.yml`: frontend, backend, ml-service (dev-сборка) |
| PostgreSQL | PLANNED | не подключена |
| Auth | PLANNED | нет |
| Документация | CONFIRMED | этот README и файлы в `docs/` |

---

## Архитектура

Целевая схема (три сервиса). Стрелка Backend -> ML пока **не реализована** в коде.

```text
Frontend (React, Vite)
   |
   v  REST
Backend (NestJS)
   |
   v  PLANNED: HTTP к ML-сервису
ML (Python)
```

Фактический поток сегодня:

```text
Пользователь / curl / Swagger
   |
   v
Backend
   |-- сохраняет DICOM на диск (UPLOAD_DIR)
   |-- метаданные в памяти процесса
   |-- MockMlClient (задержка, фиксированный ответ)
   v
Результат JSON
```

PostgreSQL в схеме нет. Подробности: [docs/architecture.md](docs/architecture.md).

---

## Стек

| Слой | Технологии (как в репозитории) |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 7 |
| Backend | NestJS 11, TypeScript, REST, Swagger, Multer |
| ML | Python 3.12 в Docker; локально достаточно stdlib для заглушки |
| Runtime | Docker Compose (dev-команды внутри контейнеров) |

---

## Структура проекта

Корень репозитория: `bonecheck-ai/` (не `ruen-ai-densitometry`).

```text
bonecheck-ai/
├── backend/                 # NestJS API
│   ├── src/
│   │   ├── main.ts
│   │   ├── configure-app.ts
│   │   ├── app.module.ts
│   │   ├── common/filters/
│   │   └── modules/
│   │       ├── health/
│   │       ├── ml/          # интерфейс MlClient + MockMlClient
│   │       └── studies/     # загрузка, статус, результат
│   ├── test/                # e2e: health, studies
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/client.ts    # только базовый URL
│   │   ├── pages/Home.tsx   # заглушка
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── Dockerfile
├── ml/
│   ├── src/
│   │   ├── app.py           # бесконечный sleep, без HTTP
│   │   ├── preprocessing/
│   │   ├── training/
│   │   ├── inference/
│   │   └── utils/
│   ├── models/              # пусто, веса не коммитятся
│   ├── notebooks/
│   ├── requirements.txt     # зависимости для будущего обучения
│   └── Dockerfile
├── docs/
├── deployment/README.md
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

Датасет DICOM и веса моделей в git **не входят**.

---

## Запуск

Требования: Node.js 20+, npm. Python нужен только если запускаете ML-заглушку локально.

1. Скопируйте переменные окружения из корня репозитория:

```bash
cp .env.example .env
```

Windows (PowerShell):

```powershell
Copy-Item .env.example .env
```

### Backend

```bash
cd backend
npm install
npm run start:dev
```

- API: http://localhost:3000
- Health: http://localhost:3000/health
- Swagger: http://localhost:3000/api/docs
- Контракт: [docs/api.md](docs/api.md)

Метаданные исследований живут **в памяти процесса**. Перезапуск backend их стирает. Файлы пишутся в `UPLOAD_DIR` (по умолчанию `./uploads` относительно cwd backend).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

- UI: http://localhost:5173
- Сейчас это статическая страница, без загрузки DICOM.

### ML

```bash
cd ml
python src/app.py
```

Процесс печатает сообщение и спит. HTTP-сервера нет, порт 8000 контейнер **не слушает** приложением. `pip install -r requirements.txt` для заглушки не обязателен (в образе зависимости не ставятся).

### Docker Compose

Из корня репозитория:

```bash
docker compose up --build
```

- frontend: http://localhost:5173
- backend: http://localhost:3000
- ml-service: контейнер-заглушка, порт хоста 8000 проброшен, но процесс внутри HTTP не поднимает

Compose **не** соединяет backend с ml-service. PostgreSQL в Compose нет.

```bash
docker compose down
```

Заметки по развёртыванию: [deployment/README.md](deployment/README.md).

---

## API

Живой OpenAPI: http://localhost:3000/api/docs (при запущенном backend).

Реализованные endpoint'ы:

| Метод | Путь | Назначение |
| --- | --- | --- |
| GET | `/health` | liveness |
| POST | `/api/studies` | загрузить один DICOM, создать запись, запустить анализ |
| GET | `/api/studies/:id` | статус |
| GET | `/api/studies/:id/result` | результат в формате полей ТЗ |

Полное описание: [docs/api.md](docs/api.md).

---

## Документация

| Файл | Содержание |
| --- | --- |
| [docs/task-analysis.md](docs/task-analysis.md) | понимание ТЗ |
| [docs/architecture.md](docs/architecture.md) | архитектура на текущем этапе |
| [docs/decisions.md](docs/decisions.md) | технические решения |
| [docs/api.md](docs/api.md) | контракт API для frontend |
| [docs/database.md](docs/database.md) | хранение данных |
| [docs/ml.md](docs/ml.md) | ML-слой |
| [docs/frontend.md](docs/frontend.md) | frontend |
| [deployment/README.md](deployment/README.md) | Docker / деплой |

---

## Что не реализовано

- реальный inference и HTTP ML-сервиса;
- PostgreSQL;
- авторизация;
- UI загрузки и отображения результата;
- пакетная загрузка нескольких файлов;
- веса модели и датасет в репозитории;
- production-сборка (nginx, `node dist/main`).
