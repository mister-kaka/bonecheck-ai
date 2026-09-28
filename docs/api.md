# API

Базовый адрес при локальном запуске: `http://localhost:3000`.

Живое описание: http://localhost:3000/api/docs

Префикс `/api` есть у методов исследований. Проверка работоспособности остаётся на `/health`.

Интерфейс ходит только в эти методы. Идентификатор сессии браузера передаётся как `session_id`. Это не идентификатор пользователя.

## Формат ошибок

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
| `error` | имя статуса |
| `code` | код для интерфейса |
| `message` | текст для пользователя |
| `status` | только у ответа 409: статус исследования |

Имена статусов в поле `error`: `BAD REQUEST`, `NOT FOUND`, `CONFLICT`, `PAYLOAD TOO LARGE`, `INTERNAL SERVER ERROR`.

## Статусы исследования

| status | Подпись |
| --- | --- |
| `uploaded` | Файл принят |
| `processing` | Идёт анализ |
| `completed` | Готово |
| `error` | Ошибка анализа |

Успешная загрузка возвращает `processing`.

---

## GET /health

Проверка, что API запущен.

Ответ 200:

```json
{
  "status": "ok"
}
```

---

## POST /api/studies

Загрузить один DICOM и создать исследование. Ответ не ждёт окончания проверки.

`Content-Type: multipart/form-data`

| Поле | Обязательно | Описание |
| --- | --- | --- |
| `file` | да | DICOM: `.dcm`, `.dicom` или тип `application/dicom` / `application/x-dicom` |
| `session_id` | нет | строка до 128 символов после обрезки пробелов |

```bash
curl -X POST http://localhost:3000/api/studies -F "file=@spine.dcm" -F "session_id=6f1c2a40-9b3e-4d7a-8c11-2e5b7a9d0c44"
```

Ответ 201:

```json
{
  "id": "3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21",
  "status": "processing",
  "createdAt": "2026-09-18T11:21:00.000Z",
  "sessionId": "6f1c2a40-9b3e-4d7a-8c11-2e5b7a9d0c44"
}
```

Без сессии `sessionId` равен `null`.

| HTTP | code | Когда |
| --- | --- | --- |
| 400 | `FILE_REQUIRED` | файл не передан или пустой |
| 400 | `INVALID_FILE_TYPE` | это не DICOM по имени или типу |
| 400 | `INVALID_SESSION_ID` | `session_id` не строка или длиннее 128 символов |
| 400 | `INVALID_FILE` | файл не удалось принять |
| 413 | `FILE_TOO_LARGE` | больше 50 МБ |
| 500 | `INTERNAL_ERROR` | сбой записи |

---

## POST /api/studies/packages

Загрузить один ZIP. Каждый DICOM внутри становится отдельным исследованием.

`Content-Type: multipart/form-data`

| Поле | Обязательно | Описание |
| --- | --- | --- |
| `file` | да | `.zip` или тип `application/zip` / `application/x-zip-compressed` |
| `session_id` | нет | та же сессия, что у загрузки одного файла |

Ограничения архива: [files.md](files.md).

Ответ 201:

```json
{
  "items": [
    {
      "id": "3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21",
      "status": "processing",
      "createdAt": "2026-09-18T11:21:00.000Z",
      "sessionId": "6f1c2a40-9b3e-4d7a-8c11-2e5b7a9d0c44",
      "originalFileName": "spine.dcm"
    }
  ]
}
```

| HTTP | code | Когда |
| --- | --- | --- |
| 400 | `FILE_REQUIRED` | архив не передан, пустой или внутри пустой DICOM |
| 400 | `INVALID_FILE_TYPE` | это не ZIP |
| 400 | `INVALID_ZIP` | архив повреждён или сжатие не поддерживается |
| 400 | `ZIP_EMPTY` | в архиве нет файлов |
| 400 | `ZIP_NO_DICOM` | нет `.dcm` / `.dicom` |
| 400 | `ZIP_UNSUPPORTED_FILE` | рядом с DICOM лежит другой файл |
| 400 | `ZIP_PATH_TRAVERSAL` | в имени есть `..` или абсолютный путь |
| 400 | `ZIP_DUPLICATE` | два DICOM с одним именем |
| 400 | `ZIP_TOO_MANY_FILES` | больше 30 записей |
| 400 | `INVALID_SESSION_ID` | сессия не строка или длиннее 128 символов |
| 413 | `FILE_TOO_LARGE` | ZIP, файл внутри или распакованный объём больше лимита |
| 500 | `INTERNAL_ERROR` | сбой записи |

---

## GET /api/studies

История исследований. Ответ — полный список. Поиск, фильтры и страницы интерфейс считает сам.

| Параметр | Обязательно | Описание |
| --- | --- | --- |
| `session_id` | нет | если задан — только эта сессия. Пустая строка равна отсутствию фильтра |

Другие query-параметры дают 400 `BAD_REQUEST` и текст «Неизвестный параметр запроса.»

Ответ 200:

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

Порядок: `createdAt` по убыванию, при равном времени — `id` по убыванию. Пустой список — 200 и `"items": []`.

Полей результата в элементе списка нет. Их отдаёт `GET /api/studies/:id/result`.

| HTTP | code | Когда |
| --- | --- | --- |
| 400 | `INVALID_SESSION_ID` | `session_id` не строка или длиннее 128 символов |
| 400 | `BAD_REQUEST` | неизвестный query-параметр |

---

## GET /api/studies/:id

Статус одного исследования. Сессия не проверяется: запись читается по идентификатору.

`id` — UUID v4.

Ответ 200 совпадает с элементом списка. При ошибке анализа:

```json
{
  "id": "3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21",
  "sessionId": null,
  "status": "error",
  "originalFileName": "spine.dcm",
  "createdAt": "2026-09-18T11:21:00.000Z",
  "updatedAt": "2026-09-18T11:21:01.000Z",
  "error": "Не удалось проверить качество укладки.",
  "hasResult": false
}
```

`hasResult` равен `true` только при `completed` и читаемом результате.

| HTTP | code | Когда |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | `id` не UUID v4. Текст: «Идентификатор исследования должен быть UUID v4.» |
| 404 | `STUDY_NOT_FOUND` | записи нет |

---

## GET /api/studies/:id/result

Результат готовой проверки.

Вызывать, когда `status` равен `completed` и `hasResult` равен `true`.

Пример корректной укладки:

```json
{
  "studyId": "3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21",
  "quality_class": 0,
  "violation_type": "",
  "anatomical_region": "Поясничный отдел позвоночника"
}
```

Пример нарушения. Поле `quality_prob` есть только если оно сохранено:

```json
{
  "studyId": "3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21",
  "quality_class": 1,
  "violation_type": "Некорректная укладка;Не выравнена ось позвоночника",
  "anatomical_region": "Поясничный отдел позвоночника",
  "quality_prob": 0.86
}
```

| Поле | Смысл |
| --- | --- |
| `studyId` | идентификатор исследования |
| `quality_class` | `0` или `1` |
| `violation_type` | нарушения через `;`, либо `""` |
| `anatomical_region` | одна из двух областей |
| `quality_prob` | необязательно, число от 0 до 1 |

Словарь значений: [results.md](results.md).

| HTTP | code | Когда |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | `id` не UUID v4 |
| 404 | `STUDY_NOT_FOUND` | записи нет |
| 409 | `RESULT_NOT_READY` | проверка ещё не завершена успешно. В теле есть `status` |
| 409 | `ANALYSIS_FAILED` | статус `error`. В `message` текст ошибки исследования, в теле есть `"status": "error"` |

Пример 409:

```json
{
  "statusCode": 409,
  "error": "CONFLICT",
  "code": "RESULT_NOT_READY",
  "message": "Результат анализа ещё не готов.",
  "status": "processing"
}
```

---

## GET /api/studies/:id/file

DICOM этого исследования. Путь на диске в ответ не входит.

Ответ 200: тело файла, `Content-Type: application/dicom`.

| HTTP | code | Когда |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | `id` не UUID v4 |
| 404 | `STUDY_NOT_FOUND` | записи нет |
| 404 | `FILE_NOT_FOUND` | запись есть, файла на диске нет |

---

## GET /api/studies/export

Файл XLSX.

| Параметр | Обязательно | Описание |
| --- | --- | --- |
| `ids` | нет | UUID v4 через запятую, не больше 200. Если параметр задан, `session_id` выборку не фильтрует |
| `session_id` | нет | сессия «Мои», если `ids` нет |

Повторы в `ids` отбрасываются. Неизвестный идентификатор — 404, файл не отдаётся. Пустая выборка по фильтру сессии — 200 и книга только с заголовками.

Колонки: «Файл», «Дата», «Анатомическая область», «Результат», «Тип нарушения», «Вероятность нарушения», «Статус».

Дата — часовой пояс `Europe/Moscow`, вид `дд.мм.гггг чч:мм`.

«Результат»: `Корректно` при классе 0, `Нарушение` при классе 1, пусто если результата нет.

Имя файла: `bonecheck-<имя>.xlsx` для одного исследования, `bonecheck-history.xlsx` для списка и пустой выборки.

`Content-Type`: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

| HTTP | code | Когда |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | пустой `ids`, больше 200 идентификаторов, не UUID, неизвестный query-параметр |
| 400 | `INVALID_SESSION_ID` | сессия не строка или длиннее 128 символов |
| 404 | `STUDY_NOT_FOUND` | одного из `ids` нет |

---

## Как интерфейс вызывает API

```text
POST /api/studies или POST /api/studies/packages
  -> сохранить id
  -> GET /api/studies/:id примерно раз в секунду
  -> при completed: GET /api/studies/:id/result и GET /api/studies/:id/file
  -> при error: показать текст, result не запрашивать
```

История: `GET /api/studies` или `GET /api/studies?session_id=`. Для области и класса качества у записей с `hasResult` дополнительно запрашивается результат.
