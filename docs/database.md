# Хранение данных

Сейчас: **SQLite-файл + DICOM на диске**.

PostgreSQL не используем. Отдельного контейнера базы нет. ORM нет: драйвер `better-sqlite3` и `SqliteStudyRepository`.

## Что есть сейчас (CONFIRMED)

### Файл базы

| | |
| --- | --- |
| Переменная | `DATABASE_PATH` |
| Локально, если переменная не задана | `<cwd>/data/bonecheck.sqlite` (при `npm start` из `backend/` это `backend/data/bonecheck.sqlite`) |
| Docker | `/app/data/bonecheck.sqlite` |
| Volume Compose | `./backend/data:/app/data` |

Каталог создаётся при старте backend. Таблица создаётся тем же стартом (`CREATE TABLE IF NOT EXISTS`). Ручной шаг «создай таблицы» не нужен. Повторный старт таблицу не удаляет.

Если процесс остановился, пока статус был `processing`, следующий старт снова вызывает ML для этих записей. Уже завершённые строки не пересчитываются.

Файл базы в git не входит (`*.sqlite`, каталог `data/`).

### Таблица `studies`

Одна таблица: метаданные исследования и поля результата. Отдельной таблицы результата нет: в API и в `StudyRecord` результат — часть той же записи, связь 1:1. `anatomical_region` хранится один раз, в колонках результата.

| Колонка | Поле API / модели | Когда заполнено |
| --- | --- | --- |
| `id` | `id` | всегда, UUID v4, первичный ключ |
| `session_id` | `sessionId` | идентификатор браузерной сессии или `NULL` |
| `status` | `status` | `uploaded` / `processing` / `completed` / `error` |
| `original_file_name` | `originalFileName` | всегда |
| `stored_file_path` | только внутри backend | путь DICOM на диске |
| `created_at` / `updated_at` | `createdAt` / `updatedAt` | ISO-8601 |
| `error` | `error` | текст при `status = error`, иначе `NULL` |
| `quality_class` | `quality_class` | `0` или `1` после успешного ML, иначе `NULL` |
| `quality_prob` | `quality_prob` | опционально, вместе с результатом |
| `violation_type` | `violation_type` | строка результата, включая `""`; `NULL`, если результата нет |
| `anatomical_region` | `anatomical_region` | опционально, вместе с результатом |

Индексы: `session_id`, `created_at`.

`session_id` — технический маркер браузера из `localStorage` (`bonecheck_session_id`). Это не `user_id`. Таблицы пользователей нет.

Список:

- `GET /api/studies?session_id=...` — исследования этой сессии;
- `GET /api/studies` — общая история, без фильтра.

### Файлы DICOM

Не в базе. `FileStorageService`, каталог `UPLOAD_DIR` (по умолчанию `uploads/` относительно cwd).

В Compose: `UPLOAD_DIR=/app/uploads`, volume `./backend/uploads:/app/uploads`.

### Инициализация

`SqliteStudyRepository` при создании открывает файл и выполняет схему. Отдельной команды миграций нет.

Чистая база: удалить файл `bonecheck.sqlite` (и при WAL — `bonecheck.sqlite-wal`, `bonecheck.sqlite-shm`) и запустить backend.

## Что не храним

Пользователей, пароли, JWT, роли. Новых медицинских полей сверх контракта ML нет.
