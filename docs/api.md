# API-контракт для frontend

Документ соответствует backend в репозитории. Живой Swagger: http://localhost:3000/api/docs (заголовок «RUEN API», версия `0.3.0`).

Базовый URL: `http://localhost:3000` (как `VITE_API_BASE_URL`).

Префикса глобального `setGlobalPrefix('api')` нет. Префикс `/api` задан только у контроллера studies.

Не вызывать ML-сервис из браузера.

---

## Формат ошибок

Одинаковый JSON:

```json
{
  "statusCode": 400,
  "error": "BAD REQUEST",
  "code": "FILE_REQUIRED",
  "message": "Файл исследования не передан. Ожидается поле формы с именем file."
}
```

| Поле | Смысл |
| --- | --- |
| `statusCode` | HTTP-код |
| `error` | текстовое имя статуса (пробелы вместо `_`) |
| `code` | машинный код для UI |
| `message` | текст, можно показать пользователю |
| `status` | опционально: статус исследования в 409 |

---

## Статусы исследования

DECISION команды (в ТЗ веб-статусов нет):

| status | Смысл | Когда бывает сейчас |
| --- | --- | --- |
| `uploaded` | файл принят, анализ не начат | в enum есть; POST сразу ставит `processing` |
| `processing` | идёт анализ | сразу после успешного POST |
| `completed` | можно запрашивать result | после mock/будущего ML |
| `error` | анализ не удался, смотри `error` | если `MlClient` бросил исключение |

Записи лежат в SQLite (`DATABASE_PATH`). Перезапуск backend их не стирает.

---

## GET /health

Назначение: проверить, что backend живой.

Request: без тела, без авторизации.

Response 200:

```json
{
  "status": "ok"
}
```

Ошибки: не специфицированы (при падении процесса endpoint недоступен).

Статусы: 200.

---

## POST /api/studies

Назначение: загрузить **один** DICOM и создать запись анализа.

CONFIRMED по ТЗ: одна строка результата = одно изображение. Поэтому MVP принимает один файл за запрос.

Request: `multipart/form-data`

| Поле | Обязательно | Описание |
| --- | --- | --- |
| `file` | да | DICOM (`.dcm` / `.dicom`; также MIME `application/dicom` / `application/x-dicom`) |
| `session_id` | нет | Технический идентификатор браузерной сессии. Не user id. Пустая строка сохраняется как `null`. Длиннее 128 символов — 400 `INVALID_SESSION_ID` |

Пример:

```bash
curl -X POST http://localhost:3000/api/studies -F "file=@spine.dcm" -F "session_id=6f1c2a40-9b3e-4d7a-8c11-2e5b7a9d0c44"
```

Проверки backend:

- нет файла или пустой buffer -> 400 `FILE_REQUIRED`;
- расширение/MIME не DICOM -> 400 `INVALID_FILE_TYPE`;
- размер больше 50 МБ (лимит Multer) -> 413 `FILE_TOO_LARGE`.

Содержимое DICOM (магия `DICM`) **не** проверяется. Достаточно имени/MIME.

Response 201:

```json
{
  "id": "3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21",
  "status": "processing",
  "createdAt": "2026-09-18T11:21:00.000Z",
  "sessionId": "6f1c2a40-9b3e-4d7a-8c11-2e5b7a9d0c44"
}
```

Без `session_id` в запросе поле `sessionId` равно `null`.

`id` - UUID v4. Дальше UI опрашивает `GET /api/studies/:id`.

Ошибки:

| HTTP | code | Когда |
| --- | --- | --- |
| 400 | `FILE_REQUIRED` | нет файла или файл пустой |
| 400 | `INVALID_FILE_TYPE` | не DICOM по имени/MIME |
| 400 | `INVALID_SESSION_ID` | `session_id` не строка или длиннее 128 символов |
| 400 | `INVALID_FILE` | прочие ошибки Multer |
| 413 | `FILE_TOO_LARGE` | больше 50 МБ |

Статусы: 201, 400, 413.

---

## GET /api/studies

Назначение: история исследований.

Query:

| Параметр | Обязательно | Описание |
| --- | --- | --- |
| `session_id` | нет | Если задан — только исследования этой сессии («Мои»). Если параметра нет или строка пустая — общая история («Все») |

`session_id` не ограничивает `GET /api/studies/:id`: по идентификатору запись читается без фильтра сессии.

Response 200:

```json
{
  "items": [
    {
      "id": "3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21",
      "sessionId": "6f1c2a40-9b3e-4d7a-8c11-2e5b7a9d0c44",
      "status": "completed",
      "originalFileName": "spine.dcm",
      "createdAt": "2026-09-18T11:21:00.000Z",
      "updatedAt": "2026-09-18T11:21:01.000Z",
      "error": null,
      "hasResult": true
    }
  ]
}
```

Порядок: сначала более новые (`created_at` по убыванию).

Ошибки: 400 `BAD_REQUEST`, если `session_id` не строка; 400 `INVALID_SESSION_ID`, если строка длиннее 128 символов.

Статусы: 200, 400.

---

## GET /api/studies/:id

Назначение: существует ли запись, какой статус, есть ли ошибка, готов ли результат.

Request: path-параметр `id` = UUID v4.

Response 200:

```json
{
  "id": "3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21",
  "sessionId": "6f1c2a40-9b3e-4d7a-8c11-2e5b7a9d0c44",
  "status": "completed",
  "originalFileName": "spine.dcm",
  "createdAt": "2026-09-18T11:21:00.000Z",
  "updatedAt": "2026-09-18T11:21:01.000Z",
  "error": null,
  "hasResult": true
}
```

Если анализ упал:

```json
{
  "id": "3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21",
  "sessionId": null,
  "status": "error",
  "originalFileName": "spine.dcm",
  "createdAt": "2026-09-18T11:21:00.000Z",
  "updatedAt": "2026-09-18T11:21:01.000Z",
  "error": "Ошибка обработки ML.",
  "hasResult": false
}
```

`hasResult` = true только при `status === completed` и наличии объекта результата.

Ошибки:

| HTTP | code | Когда |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | `id` не UUID v4 (ParseUUIDPipe) |
| 404 | `STUDY_NOT_FOUND` | нет записи |

Статусы: 200, 400, 404.

---

## GET /api/studies/:id/result

Назначение: результат анализа в полях ТЗ.

Вызывать, когда `status === "completed"` и `hasResult === true`.

Request: path-параметр `id` = UUID v4.

Response 200 (пример текущего **mock**):

```json
{
  "studyId": "3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21",
  "quality_class": 0,
  "violation_type": "",
  "quality_prob": 0.05,
  "anatomical_region": "Поясничный отдел позвоночника"
}
```

Поля:

| Поле | Источник | Смысл |
| --- | --- | --- |
| `studyId` | backend | id записи |
| `quality_class` | CONFIRMED ТЗ | `0` корректно, `1` нарушение |
| `violation_type` | CONFIRMED ТЗ | текст; несколько через `;`; `""` если нет нарушений |
| `quality_prob` | CONFIRMED как опциональное | `[0; 1]`, ключ может отсутствовать |
| `anatomical_region` | CONFIRMED допустимые значения | может отсутствовать |

Допустимые `anatomical_region`:

- `Поясничный отдел позвоночника`
- `Проксимальный отдел бедра`

Допустимые `violation_type` - [task-analysis.md](task-analysis.md).

Сейчас результат всегда отдаёт **MockMlClient**, не модель Кирилла. Типичный mock: класс 0, пустой тип, `quality_prob=0.05`, регион позвоночника.

Ошибки:

| HTTP | code | Когда |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | `id` не UUID v4 |
| 404 | `STUDY_NOT_FOUND` | нет записи |
| 409 | `RESULT_NOT_READY` | ещё `processing` / нет result |
| 409 | `ANALYSIS_FAILED` | `status = error` |

В 409 может быть поле `status`.

Статусы: 200, 400, 404, 409.

---

## Рекомендуемый сценарий UI

```text
1. Пользователь выбирает DICOM
2. POST /api/studies  (поле file и session_id из localStorage)
3. Сохранить id
4. Каждые 1-2 сек GET /api/studies/:id
5. Если completed -> GET /api/studies/:id/result
6. Если error -> показать message / поле error
```

---

## PLANNED (нет в коде)

- авторизация;
- экран «Мои / Все» (endpoint списка уже есть);
- пакетная загрузка нескольких файлов;
- удаление исследования;
- heatmap / координаты;
- клинический диагноз;
- HTTP proxy на Python ML (для клиента это прозрачно: те же studies-endpoint'ы).
