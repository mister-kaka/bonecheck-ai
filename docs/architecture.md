# Архитектура BoneCheck AI (RUEN)

Документ описывает **реальную** архитектуру на 2026-09-18, не целевой прод.

## Общая схема

Три сервиса в монорепозитории. Публичная точка входа для UI и экспертов - backend.

```text
┌─────────────────────┐
│ Frontend (React)    │  заглушки / и /history
└──────────┬──────────┘
           │ REST JSON  (вызовы из UI пока не сделаны)
           v
┌─────────────────────┐
│ Backend (NestJS)    │  API, валидация, оркестрация, mock ML
└──────────┬──────────┘
           │ PLANNED: HTTP к Python
           v
┌─────────────────────┐
│ ML Service (Python) │  контейнер-заглушка, без HTTP и модели
└─────────────────────┘
```

Метаданные — файл SQLite, не PostgreSQL и не отдельный контейнер БД. См. [database.md](database.md).

## Основной поток данных (как работает код)

```text
Пользователь (Swagger / curl; UI загрузки ещё нет)
    |
    v
Frontend (опционально, позже)
    |
    v
POST /api/studies  (multipart: file, опционально session_id)
    |
    v
Backend
    |-- проверка: файл есть, не пустой, DICOM, <= 50 МБ
    |-- запись на диск: UPLOAD_DIR/<uuid>/<filename>
    |-- запись метаданных в SQLite (SqliteStudyRepository)
    |-- статус сразу processing
    |-- асинхронно MockMlClient.analyze()
    v
ML (сейчас mock внутри backend, не Python-контейнер)
    |
    v
Результат в той же строке SQLite (quality_class, violation_type, ...)
    |
    v
GET /api/studies
GET /api/studies/:id
GET /api/studies/:id/result
    |
    v
Frontend / пользователь
```

## Frontend

Статус: заглушка. Подробности: [frontend.md](frontend.md).

- стек: React + TypeScript + Vite;
- маршруты `/` (`Home`) и `/history` (`HistoryPage`), обе страницы - заглушки;
- хедер с навигацией; `Button` и `Card` в страницах не используются;
- `src/api/client.ts` задаёт `VITE_API_BASE_URL`, запросов нет;
- ML не вызывается из браузера. Это принятое правило, даже когда UI появится.

## Backend

Статус: рабочий MVP-каркас прикладного слоя.

Модули NestJS:

| Модуль | Роль |
| --- | --- |
| `HealthModule` | `GET /health` -> `{ "status": "ok" }` |
| `StudiesModule` | загрузка, статус, результат |
| `MlModule` | провайдер `ML_CLIENT` = `MockMlClient` |

Важное поведение:

- CORS включён глобально;
- OpenAPI на `/api/docs`, заголовок Swagger: «RUEN API», версия `0.3.0`;
- единый формат ошибок: `statusCode`, `error`, `code`, `message`;
- единица API-записи называется `study`, но **один POST = один файл**. Это не папка исследования из датасета.

Backend **не** парсит DICOM и **не** обучает модель.

## ML

Статус: каркас. Подробности: [ml.md](ml.md).

- каталог `ml/` с пакетами preprocessing / training / inference / utils (почти пустые);
- `ml/src/app.py` печатает сообщение и спит;
- Docker пробрасывает порт 8000, процесс его не слушает;
- backend **не** вызывает этот контейнер.

Контракт результата уже зафиксирован в TypeScript (`ml.types.ts`) по полям ТЗ, чтобы UI можно было подключать до модели Кирилла.

## База данных

Статус: **CONFIRMED**, файл SQLite. Подробности: [database.md](database.md).

Метаданные: `SqliteStudyRepository`, путь `DATABASE_PATH`. Файлы DICOM: локальная ФС.

## Файловое хранение

Статус: **CONFIRMED**.

- сервис `FileStorageService`;
- путь: `process.env.UPLOAD_DIR` или `<cwd>/uploads`;
- раскладка: `<UPLOAD_DIR>/<studyId>/<safeFileName>`;
- в git игнорируется (`backend/uploads/`, `/uploads/`);
- blob в БД не используется.

Общий volume с Python-сервисом: **TBD** (появится вместе с HTTP-контрактом ML).

## Взаимодействие компонентов

| Связь | Сейчас |
| --- | --- |
| Frontend -> Backend | задумано через REST; UI ещё не ходит в API |
| Backend -> ML контейнер | нет |
| Backend -> MockMlClient | да, in-process |
| Backend -> БД | да, локальный файл SQLite; отдельного сервиса БД нет |
| Compose: frontend depends_on backend | да |
| Compose: backend depends_on ml-service | нет |

## Сетевые порты

| Сервис | Порт | Слушает приложение |
| --- | --- | --- |
| frontend | 5173 | да (Vite) |
| backend | 3000 | да |
| ml-service | 8000 | нет (заглушка без HTTP) |

## Принципы

1. Датасет и веса не коммитятся.
2. Клиническая диагностика не является выходом MVP.
3. Единица результата по ТЗ - одно изображение (один DICOM-файл).
4. Публичный контракт - backend; ML - внутренний сервис (**PLANNED** подключение).
5. Решение должно работать локально, без облачных API для анализа снимков (требование организаторов).
