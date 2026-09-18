# Хранение данных

Статус БД: **PLANNED**

PostgreSQL в runtime **не используется**. В `docker-compose.yml` сервиса БД нет. Приложение не читает `DATABASE_URL`.

## Что есть сейчас (CONFIRMED)

### Метаданные исследования

Реализация: `InMemoryStudyRepository` (`Map` в процессе NestJS).

Интерфейс замены: `StudyRepository` (`save`, `findById`).

Поля записи `StudyRecord`:

| Поле | Назначение |
| --- | --- |
| `id` | UUID v4 |
| `status` | `uploaded` / `processing` / `completed` / `error` |
| `originalFileName` | имя загруженного файла |
| `storedFilePath` | путь на диске |
| `createdAt` / `updatedAt` | ISO-8601 |
| `error` | текст ошибки анализа или `null` |
| `result` | объект предсказания или `null` |

Связей между записями нет. Списка всех id API не отдаёт.

Последствия: перезапуск backend = пустое хранилище.

### Файлы DICOM

Не в БД. Локальный диск, см. [architecture.md](architecture.md).

Каталог по умолчанию: `uploads/` (cwd процесса). Переменная: `UPLOAD_DIR`.

## Что запланировано

Статус: **PLANNED**

Когда инфраструктура будет готова, `StudyRepository` можно заменить таблицей `studies`. Комментарий в `.env.example`:

```text
DATABASE_URL=postgresql://ruen:ruen@localhost:5432/ruen
```

Это шаблон, не рабочая конфигурация.

Схему таблиц, индексы и миграции **не фиксируем**: их ещё нет в коде.

TBD:

- кто поднимает Postgres (Team Lead / инфраструктура);
- хранить ли JSON результата отдельной колонкой;
- нужен ли TTL для загрузок.
