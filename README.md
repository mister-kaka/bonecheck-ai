# AI-сервис оценки качества DICOM-исследований плотности костей

Монорепозиторий решения хакатонной задачи ЛЦТ 2026 (направление «Город», Департамент здравоохранения Москвы): автоматическая оценка качества укладки денситометрических исследований (DXA / DICOM CR) без клинической диагностики заболеваний.

Этот репозиторий на текущем этапе содержит каркас проекта: API, UI, ML-сервис и Docker. Бизнес-логика, модель и обработка DICOM намеренно не реализованы.

## Стек

| Слой | Технологии |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Backend | NestJS, TypeScript, REST, Swagger |
| ML | Python (каркас inference-сервиса) |
| Runtime | Docker Compose |

## Архитектура

```text
Frontend (React)
        ↓ REST
NestJS Backend
        ↓ HTTP (позже)
Python ML Service
```

Подробности: `docs/architecture.md`, `docs/decisions.md`, `docs/task-analysis.md`.

## Структура проекта

```text
ruen-ai-densitometry/
├── backend/          # NestJS REST API
├── frontend/         # React + Vite UI
├── ml/               # Python ML service skeleton
├── deployment/       # заметки по развёртыванию
├── docs/             # архитектура и решения
├── docker-compose.yml
└── .env.example
```

## Локальный запуск (без Docker)

Требования: Node.js 20+, npm 10+, Python 3.11+ (для ML-слоя позже).

1. Скопируйте переменные окружения:

```bash
cp .env.example .env
```

На Windows (PowerShell):

```powershell
Copy-Item .env.example .env
```

2. Backend:

```bash
cd backend
npm install
npm run start:dev
```

- API: `http://localhost:3000`
- Health: `http://localhost:3000/health`
- Swagger: `http://localhost:3000/api/docs`

3. Frontend:

```bash
cd frontend
npm install
npm run dev
```

- UI: `http://localhost:5173`

4. ML placeholder:

```bash
cd ml
pip install -r requirements.txt
python src/app.py
```

## Запуск через Docker Compose

```bash
docker compose up --build
```

Сервисы:

- frontend: `http://localhost:5173`
- backend: `http://localhost:3000`
- ml-service: контейнер-заглушка (порт `8000`)

Остановка:

```bash
docker compose down
```

## Что пока не входит в репозиторий

- веса моделей;
- датасет DICOM;
- авторизация и база данных;
- inference и препроцессинг.
