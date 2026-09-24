Status: READY FOR IMPLEMENTATION
Owner: Maria
Implementer: Karina

# Backend Business Logic Spec v1

Этот документ — источник истины для backend business logic BoneCheck AI. Продуктовые решения принимает Maria. Реализует Karina.

Код в этом этапе не менялся. Расхождения с текущим backend перечислены в разделе «Расхождения с текущим кодом» и остаются TODO реализации. Новые продуктовые сценарии не входят в работу: нет пользователей, ролей, JWT, PostgreSQL, Redis, Kafka, очереди задач, пагинации, политики повторов, автоматического удаления файлов, heatmap, contour и keypoints.

Открытых продуктовых вопросов нет.

---

## 1. Purpose

Backend принимает один DICOM-файл, сохраняет исследование вместе с браузерным `session_id`, отдаёт файл во внутренний ML-клиент и сохраняет один результат анализа.

Публичный сценарий:

```text
загрузка файла
  -> исследование в статусе processing
  -> клиент опрашивает статус
  -> при completed забирает результат
  -> при error видит, что анализ не удался
```

История:

- «Мои» — исследования с тем же `session_id`;
- «Все» — все исследования.

`session_id` — UUID браузерной сессии из `localStorage`, не пользователь и не право доступа. `GET /api/studies/:id` и `GET /api/studies/:id/result` по сессии не фильтруются.

Клиент ходит только в NestJS. Python ML из браузера не вызывается.

---

## 2. Current architecture

Три каталога монорепозитория: `frontend/`, `backend/`, `ml/`. Для этой спецификации рабочая система — backend.

```text
Frontend
  |  REST, multipart / JSON
  v
NestJS backend
  |-- StudiesController          HTTP
  |-- StudiesService             lifecycle
  |-- FileStorageService         DICOM на диск
  |-- SqliteStudyRepository      файл SQLite
  |-- MlClient                   сейчас MockMlClient в том же процессе
  v
ml/                              контейнер-заглушка, backend его не вызывает
```

| Часть | Файл | Роль |
| --- | --- | --- |
| HTTP | `backend/src/modules/studies/studies.controller.ts` | `POST/GET /api/studies` |
| Lifecycle | `backend/src/modules/studies/studies.service.ts` | создание, ML, статусы, ошибки |
| Модель | `backend/src/modules/studies/study.types.ts` | `StudyRecord`, `StudyStatus` |
| SQLite | `backend/src/modules/studies/sqlite-study.repository.ts` | таблица `studies` |
| Файл | `backend/src/modules/studies/file-storage.service.ts` | каталог `UPLOAD_DIR` |
| Проверка файла | `backend/src/modules/studies/file-validation.ts` | DICOM по имени/MIME, 50 МБ |
| ML-контракт | `backend/src/modules/ml/ml.types.ts` | вход и выход `MlClient` |
| ML сейчас | `backend/src/modules/ml/mock-ml.client.ts` | фиксированный ответ |
| Ошибки HTTP | `backend/src/common/filters/http-exception.filter.ts` | JSON без stack trace |
| Swagger | `backend/src/main.ts` | `GET /api/docs`, `GET /api/docs-json` |
| Health | `backend/src/modules/health/health.controller.ts` | `GET /health` |

Глобального префикса `api` нет. Префикс есть только у контроллера studies. Health остаётся `GET /health`.

Метаданные — один файл SQLite (`DATABASE_PATH`). ORM нет. Отдельной таблицы результата нет: поля результата лежат в той же строке `studies`. Это связь «одно исследование — не больше одного результата». Вторую таблицу не создавать.

Сейчас `ML_CLIENT` — `MockMlClient`. Он не ходит в сеть. Замена клиента не меняет контроллеры и имена полей JSON.

После успешного `INSERT` сервис не ждёт ML. `POST` отвечает сразу. Анализ идёт в том же процессе, отдельно по каждому `id`. Общего объекта «текущее исследование» в памяти нет.

---

## 3. Entities

### 3.1. Study

Логическая сущность — строка таблицы `studies`. Отдельной сущности History нет.

Фактические колонки, их и сохранять:

| Поле модели | Колонка SQLite | Зачем | Кто ставит | После создания |
| --- | --- | --- | --- | --- |
| `id` | `id` | UUID v4, первичный ключ | backend, `randomUUID()`, до записи файла | не меняется |
| `sessionId` | `session_id` | фильтр «Мои»; `NULL`, если сессия не передана | backend из поля формы | не меняется |
| `originalFileName` | `original_file_name` | имя в истории и во входе ML | backend из загруженного файла | не меняется |
| `storedFilePath` | `stored_file_path` | путь к DICOM для `MlClient` | backend после записи на диск | не меняется; в API не отдаётся |
| `status` | `status` | стадия lifecycle | backend | только переходы из раздела 5 |
| `createdAt` | `created_at` | момент создания, сортировка истории, ISO-8601 | backend | не меняется |
| `updatedAt` | `updated_at` | момент записи `completed` или `error` | backend | меняется вместе с конечным статусом |
| `error` | `error` | текст для клиента при неуспешном анализе | backend | `NULL` в `processing` и `completed`; строка в `error` |
| `result` | колонки ниже | итог ML, не отдельная сущность | backend только при `completed` | при `error` колонки `NULL` |

Колонки результата в той же строке:

| Поле результата | Колонка |
| --- | --- |
| `quality_class` | `quality_class` |
| `quality_prob` | `quality_prob` |
| `violation_type` | `violation_type` |
| `anatomical_region` | `anatomical_region` |

`anatomical_region` не является отдельным атрибутом загрузки. Он приходит только из ML и хранится один раз, в колонке результата.

Не хранить и не добавлять колонки: пользователь, пароль, роль, `PixelSpacing`, `pixel_x_mm`, `pixel_y_mm`, heatmap, contour, keypoints, диагноз.

`hasResult` в ответах статуса — вычисляемое поле, не колонка:

```text
hasResult = (status == completed) AND (результат читается)
```

Результат читается, только если в строке одновременно:

- `quality_class` равен `0` или `1`;
- `violation_type` — строка, согласованная с этим классом по разделу 7;
- `anatomical_region` — одно из двух допустимых значений.

Пока validation не записывает иной итог, чтение не должно объявлять `hasResult = true` для строки без этих полей.

### 3.2. StudyResult

Отдельной таблицы и отдельного id результата нет. Успешный `GET /api/studies/:id/result` отдаёт поля той же строки.

Результат существует только вместе со статусом `completed`.

| Поле API | Колонка | В успешном JSON | Смысл |
| --- | --- | --- | --- |
| `studyId` | `id` | обязательно | связь с Study |
| `quality_class` | `quality_class` | обязательно | `0` или `1` |
| `violation_type` | `violation_type` | обязательно | строка, включая `""` |
| `anatomical_region` | `anatomical_region` | обязательно | один из двух регионов |
| `quality_prob` | `quality_prob` | необязательно | число в `[0; 1]`, если ML его вернул |

`quality_prob` отсутствует в JSON, если в базе `NULL`.

`anatomical_region` в успешном ответе обязателен. Текущий DTO помечает его необязательным; это расхождение, его закрывает реализация, не новая колонка.

`violation_type = ""` значит «нарушений нет». Это значение результата, не `NULL`. `NULL` в колонке значит «результата нет».

---

## 4. Study lifecycle

`processing` — начальный статус записи, не отдельный апдейт после создания.

```text
1. Проверить файл и session_id
2. Назначить id
3. Записать файл на диск
4. Вставить Study: session_id, путь, status = processing, колонки результата = NULL
5. Ответить клиенту 201
6. Вызвать ML для этого id
7. Структурная validation, затем business validation
8. Одной записью в SQLite:
     valid   -> колонки результата + status = completed
     invalid -> колонки результата = NULL + status = error
     exception ML -> то же, что invalid
```

| Момент | Что происходит |
| --- | --- |
| ID назначен | после успешной проверки входа, до записи файла. Клиент его ещё не получил |
| Файл сохранён | после назначения id, до `INSERT` |
| Study создан | успешный `INSERT`. До этого исследования нет |
| `session_id` сохранён | в том же `INSERT`. Если сессии нет, колонка `NULL` |
| `processing` установлен | в том же `INSERT` |
| Ответ клиенту | после `INSERT`, не дожидаясь ML. В теле всегда `processing` |
| ML вызван | после ответа, асинхронно, только если строка всё ещё `processing` |
| StudyResult создан | в базе только вместе с `completed`, после validation |
| `completed` установлен | в том же statement, который пишет поля результата |
| `error` установлен | в том же statement, который очищает поля результата |

Пока шаг 8 не закоммичен, в базе остаётся `processing` и пустой результат.

`completed` и `error` в ML повторно не отправляются, в том числе после restart.

Если процесс остановился на шаге 6 или 7 и строка всё ещё `processing`, следующий старт снова вызывает ML только для таких строк. Это не очередь и не retry policy: при старте один проход по уже существующим `processing`.

---

## 5. Statuses

Рабочий набор:

```text
processing
completed
error
```

| status | Смысл | Когда ставится |
| --- | --- | --- |
| `processing` | файл и строка есть, итога ещё нет | в `INSERT` при создании |
| `completed` | ответ ML прошёл validation, результат записан | одной записью с полями результата |
| `error` | анализ закончился неуспешно, результата нет | одной записью с пустыми полями результата |

`completed` и `error` конечные. Обратных переходов нет.

### `uploaded`

В `StudyStatus` и в `CHECK` таблицы есть значение `uploaded`. Сервис его не записывает. `POST` создаёт `processing`.

В бизнес-логике `uploaded` не используется. Новых переходов через него нет. Реализация не начинает его записывать и не удаляет его из `CHECK`: для этого нужна отдельная миграция схемы, она не входит в задачу.

### Переходы

| From | To | Причина |
| --- | --- | --- |
| — | `processing` | создана новая строка после успешной загрузки файла |
| `processing` | `completed` | ответ ML прошёл structural и business validation, поля результата записаны |
| `processing` | `error` | исключение ML-клиента либо ответ не прошёл validation |

Других переходов нет.

---

## 6. Upload flow

```text
POST /api/studies
Content-Type: multipart/form-data
```

| Поле | Где | Обязательно | Правило |
| --- | --- | --- | --- |
| `file` | часть формы с именем `file` | да | один файл |
| `session_id` | поле формы | нет | раздел 10 |

Успех: **201**. Ответ не ждёт ML.

```json
{
  "id": "3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21",
  "status": "processing",
  "createdAt": "2026-09-18T11:21:00.000Z",
  "sessionId": "6f1c2a40-9b3e-4d7a-8c11-2e5b7a9d0c44"
}
```

Без сессии или с пустой сессией `sessionId` равен `null`.

В 201 нет имени файла, пути, результата и `hasResult`.

Порядок отказа:

1. Файл больше 50 МБ и отсечён Multer → **413** `FILE_TOO_LARGE`. Строки нет.
2. Файл не передан или пустой → **400** `FILE_REQUIRED`.
3. Имя/MIME не DICOM → **400** `INVALID_FILE_TYPE`.
4. `session_id` не строка или длиннее 128 символов → **400** `INVALID_SESSION_ID`. Файл ещё не пишется.
5. Запись файла бросила ошибку → **500** `INTERNAL_ERROR`. Строки нет. Путь и stack trace клиенту не возвращаются.
6. `INSERT` бросил ошибку после записи файла → **500** `INTERNAL_ERROR`. Строки нет. Файл на диске может остаться и автоматически не удаляется.
7. Иначе → **201**, затем асинхронный ML.

Проверка файла остаётся текущей:

- расширение `.dcm` или `.dicom` достаточно;
- без расширения достаточно MIME `application/dicom` или `application/x-dicom`;
- MIME `application/dicom` и `application/x-dicom` принимаются и при другом расширении;
- последовательность `DICM` не проверяется;
- лимит — константа `50 * 1024 * 1024`. Переменная `MAX_FILE_SIZE_BYTES` из `.env.example` кодом не читается. Источник лимита не менять.

Один запрос — один файл. Пакет, zip и папка исследования в API не входят.

---

## 7. ML flow

```text
Study (status = processing, есть storedFilePath)
  -> MlClient.analyze
  -> структурная validation
  -> business validation
  -> одна запись SQLite
       valid     -> result + completed
       invalid   -> error, результата нет
       exception -> error, результата нет
```

Проверка выполняется до записи `completed`. Невалидный ответ не остаётся `processing` и после restart в ML не отправляется.

Исключение validation не должно уходить во внешний catch, который только пишет лог и оставляет строку `processing`. Итог `error` нужно сохранить тем же путём, что и исключение клиента.

### 7.1. Что уходит в ML

Объект `MlAnalyzeInput`, без изменений:

| Поле | Откуда |
| --- | --- |
| `studyId` | `Study.id` |
| `filePath` | `storedFilePath` |
| `originalFileName` | исходное имя файла |

Тело файла в объект не копируется. Клиент читает файл по пути.

### 7.2. Pixel scale

Доменные константы аппарата, подтверждённые организатором:

```text
pixel_x_mm = 0.6
pixel_y_mm = 1.05
```

Это 0.6 мм на пиксель по X и 1.05 мм на пиксель по Y.

Текущий контракт `MlAnalyzeInput` этих полей не содержит. В SQLite их нет. В API их нет. Добавлять их в базу и в запрос ML только ради хранения не нужно. DICOM `PixelSpacing` не читать и не подставлять вместо этих констант.

Константы остаются правилом для ML-слоя, когда тот считает геометрию. Этот backend их не передаёт, потому что действующий вход клиента их не принимает.

### 7.3. Timeout

На текущем MVP отдельный бизнес-требуемый timeout ML не определён. Backend использует фактическое завершение или ошибку ML-клиента. Числовой timeout не назначается.

`MockMlClient` в сеть не ходит. Своего лимита ожидания у вызова нет. `busy_timeout` SQLite — это ожидание блокировки файла базы, не timeout ML.

Если позже у HTTP-клиента появится технический timeout библиотеки, он не становится бизнес-правилом этой спецификации. Исключение такого клиента обрабатывается как любая другая ошибка ML: `status = error`.

Пока вызов не завершился и исключения нет, статус остаётся `processing`.

### 7.4. Структурная validation

Ответ непригоден, если нарушено любое условие:

| Поле | Правило |
| --- | --- |
| тело ответа | объект, не `null` |
| `quality_class` | тип `number`, `Number.isInteger`, значение ровно `0` или `1`. Строка `"0"`, boolean, `null`, отсутствие поля, `2`, `-1`, дробное число — невалидны |
| `violation_type` | тип `string`. `null` и отсутствие поля невалидны. `""` на этом шаге допустима |
| `anatomical_region` | тип `string` и ключ присутствует. Отсутствие, `null` и не-строка невалидны |
| `quality_prob` | ключ отсутствует — допустимо. Если ключ есть: конечное число и `0 <= quality_prob <= 1`. Строка, `null`, `NaN`, бесконечность, значение меньше 0 или больше 1 — невалидны |

`quality_prob` не становится обязательным, если ML его не вернул.

### 7.5. Business validation

Выполняется только после структурной проверки.

`anatomical_region` обязателен у валидного результата. Текущий TypeScript-контракт `MlPrediction` помечает поле как необязательное и не выбирает по нему набор нарушений. Утверждённая проверка нарушений без региона невозможна, поэтому единый контракт валидного результата такой: поле обязательно и в сохранённом результате, и в JSON `200` метода `GET /api/studies/:id/result`.

Допустимы только точные строки, без обрезки пробелов и без других значений:

```text
Поясничный отдел позвоночника
Проксимальный отдел бедра
```

Для `Поясничный отдел позвоночника` допустимы только:

```text
Некорректная укладка
Не выравнена ось позвоночника
Присутствуют посторонние предметы
```

Для `Проксимальный отдел бедра` допустимы только:

```text
Некорректная укладка
Некорректная область интереса
```

Других текстов нарушений нет.

Связка класса и текста:

| `quality_class` | `violation_type` |
| --- | --- |
| `0` | ровно `""` |
| `1` | непустая строка из одного или нескольких допустимых нарушений этого региона |

Невалидные примеры:

```text
quality_class = 0
violation_type = "Некорректная укладка"
```

```text
quality_class = 1
violation_type = ""
```

```text
anatomical_region = "Поясничный отдел позвоночника"
violation_type = "Некорректная область интереса"
```

Правило разбора `violation_type` при `quality_class = 1`:

1. Строка не переписывается и не обрезается целиком.
2. Деление только по символу `;`, как в форме `Нарушение 1;Нарушение 2`.
3. Пробелы вокруг `;` не отбрасываются. Фрагмент ` Некорректная укладка` не равен допустимому значению и невалиден.
4. Пустой фрагмент невалиден. Невалидны ведущий `;`, хвостовой `;` и `;;`.
5. Каждый фрагмент должен точно совпасть с одним допустимым нарушением выбранного региона.
6. Повтор одного и того же фрагмента невалиден.
7. Нарушение из списка другого региона невалидно.
8. Если строка валидна, в базу пишется исходная строка ML, без сортировки и без новой склейки.

При `quality_class = 0` список региона не разбирается: годится только точная пустая строка. Регион при этом всё равно обязателен и должен входить в закрытый список.

### 7.6. Ошибки ML

Один внешний текст для всех неуспешных исходов анализа:

```text
Ошибка обработки ML.
```

Он используется для:

- исключения ML-клиента;
- недоступности ML;
- сетевой ошибки;
- timeout, если клиент позже завершится таким исключением;
- ответа, не прошедшего structural или business validation.

| Ситуация | Запись в SQLite | Что видит клиент |
| --- | --- | --- |
| `analyze` бросил исключение | `status = error`, `error` = текст выше, колонки результата `NULL` | `GET :id` → 200, `status = error` |
| ответ не прошёл validation | то же | то же |
| вызов ещё не завершился | строка остаётся `processing` | `hasResult = false` |

Текст исключения, HTTP-код ML, путь к файлу и stack trace в колонку `error` и в JSON клиента не пишутся. Серверный лог может содержать stack.

Текущий mock уже возвращает валидный объект: класс `0`, пустой `violation_type`, регион поясничного отдела, `quality_prob = 0.05`. Менять этот ответ не требуется.

---

## 8. Result flow

### `GET /api/studies/:id`

Назначение: есть ли исследование, какой статус, есть ли текст ошибки, можно ли запрашивать результат.

Вход: path `id`, UUID v4. Тела нет. `session_id` не проверяется.

Успех: **200**. Тело не содержит полей ML и пути к файлу.

| Состояние | HTTP | Тело |
| --- | --- | --- |
| `processing` | 200 | `status = processing`, `error = null`, `hasResult = false` |
| `completed` и результат читается | 200 | `status = completed`, `error = null`, `hasResult = true` |
| `error` | 200 | `status = error`, `error` — текст колонки, `hasResult = false` |
| id не UUID v4 | 400 | `BAD_REQUEST` |
| строки нет | 404 | `STUDY_NOT_FOUND` |

Для `processing` метод возвращает исследование и не подставляет результат.

### `GET /api/studies/:id/result`

Назначение: отдать уже сохранённый валидный результат.

Порядок:

1. id не UUID v4 → **400** `BAD_REQUEST`.
2. Строки нет → **404** `STUDY_NOT_FOUND`.
3. `status = error` → **409** `ANALYSIS_FAILED`. В теле есть `message` (текст колонки `error` или запасная фраза «Анализ исследования завершился с ошибкой.») и `status: "error"`. Полей результата нет, даже если колонки по ошибке заполнены.
4. Статус не `completed` или результат не читается по разделу 3.1 → **409** `RESULT_NOT_READY`. Сюда входит `processing`.
5. Иначе **200** и StudyResult.

Пример 200:

```json
{
  "studyId": "3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21",
  "quality_class": 0,
  "violation_type": "",
  "quality_prob": 0.05,
  "anatomical_region": "Поясничный отдел позвоночника"
}
```

В этом JSON обязательны `studyId`, `quality_class`, `violation_type`, `anatomical_region`. `quality_prob` есть только если колонка не `NULL`.

Пока статус `processing`, метод возвращает 409 и пустой результат не собирает.

Успешный сценарий не оставляет `completed` без результата и не оставляет читаемый результат при `processing`.

---

## 9. History

Отдельная сущность не создаётся. Пагинации нет.

```text
GET /api/studies
GET /api/studies?session_id=<значение>
```

| Вызов | Выборка |
| --- | --- |
| без `session_id`, пустая строка или строка из пробелов | все исследования, «Все» |
| непустой `session_id` после trim | только эта сессия, «Мои» |

Сортировка: `created_at` по убыванию, при равном времени — `id` по убыванию.

Ответ **200**:

```json
{
  "items": []
}
```

Элемент `items` — тот же объект, что у `GET /api/studies/:id`. Полей ML внутри списка нет. Пустая выборка — 200 и `items: []`, не 404.

Фильтра по статусу, региону, дате и имени файла нет.

Длинный `session_id` (> 128) → **400** `INVALID_SESSION_ID`.

`session_id` списка не ограничивает чтение по id.

---

## 10. session_id

`session_id` — UUID браузерной сессии, не пользователь. Frontend создаёт его один раз и хранит в `localStorage` под ключом `bonecheck_session_id`.

Backend:

- принимает значение из текущего API;
- сохраняет его в `session_id`;
- фильтрует им историю;
- не проверяет, что где-то существует пользователь;
- не вводит authentication.

| Операция | Поведение |
| --- | --- |
| `POST` с непустой строкой не длиннее 128 символов | trim, сохранить, вернуть в `sessionId` |
| `POST` без поля, `null`, `""` или пробелы | сохранить `NULL`, вернуть `sessionId: null` |
| `POST` длиннее 128 или не строка | 400, файл не сохранять, строку не создавать |
| `GET /api/studies?session_id=` | фильтр «Мои» |
| чтение по id | сессия не проверяется |

Формат UUID на backend не проверяется. Текущий контракт и тесты принимают строку до 128 символов, в том числе короткие значения. Ужесточение до UUID не входит в реализацию.

Исследование с `session_id = NULL` видно только в «Все». После restart тот же `session_id` снова находит те же строки.

Не создавать `users`, `accounts`, JWT, login, password, роли.

---

## 11. Error handling

Тело ошибки, без stack trace:

```json
{
  "statusCode": 400,
  "error": "BAD REQUEST",
  "code": "FILE_REQUIRED",
  "message": "Файл исследования не передан. Ожидается поле формы с именем file."
}
```

Поле `status` добавляется только у 409 и содержит статус исследования.

| HTTP | code | Когда |
| --- | --- | --- |
| 400 | `FILE_REQUIRED` | файл не передан или пустой |
| 400 | `INVALID_FILE_TYPE` | не DICOM по имени/MIME |
| 400 | `INVALID_SESSION_ID` | `session_id` не строка или длиннее 128 |
| 400 | `INVALID_FILE` | прочая ошибка Multer |
| 400 | `BAD_REQUEST` | id не UUID v4; прочий отказ validation pipe |
| 404 | `STUDY_NOT_FOUND` | нет строки |
| 409 | `RESULT_NOT_READY` | результат запрошен, а анализ не завершён успешно или результат не читается |
| 409 | `ANALYSIS_FAILED` | результат запрошен у исследования в `error` |
| 413 | `FILE_TOO_LARGE` | файл больше 50 МБ |
| 500 | `INTERNAL_ERROR` | необработанная ошибка, в том числе сбой записи файла или `INSERT` |

Ошибка анализа — это `Study.status = error`, не HTTP 500 на последующих опросах. `GET /api/studies/:id` при этом возвращает 200. `GET /api/studies/:id/result` возвращает 409 `ANALYSIS_FAILED`.

Внутренности SQLite, путь к файлу, адрес ML и stack trace в этот JSON не входят.

---

## 12. Persistence и restart

```text
рестарт процесса
  -> тот же файл SQLite
  -> те же studies
  -> те же результаты
  -> та же история и тот же session_id
```

| | |
| --- | --- |
| Переменная | `DATABASE_PATH` |
| Локально, если не задана | `<cwd>/data/bonecheck.sqlite` |
| Docker | `/app/data/bonecheck.sqlite` |
| Volume | `./backend/data:/app/data` |

Каталог и таблица создаются при старте (`CREATE TABLE IF NOT EXISTS`). Повторный старт данные не удаляет. Отдельной миграции нет.

Поведение restart, его и сохранить:

| Статус до остановки | После старта |
| --- | --- |
| `processing` | строка на месте, ML вызывается снова |
| `completed` | та же строка и тот же результат, ML не вызывается |
| `error` | та же строка, ML не вызывается |

```text
processing → restart → повторная попытка ML
error      → restart → остаётся error
completed  → restart → остаётся completed
```

Журнал SQLite: `WAL`, `synchronous = FULL`, `busy_timeout = 5000`. Это настройка файла базы, не очередь и не timeout ML.

Схема не переписывается. `uploaded` в `CHECK` остаётся. Новых ограничений SQL на текст региона и нарушений не добавлять: закрытые списки проверяет приложение до записи.

---

## 13. File storage

| | |
| --- | --- |
| Где лежит файл | `UPLOAD_DIR/<studyId>/<безопасное имя>` |
| Локальный корень | `UPLOAD_DIR` или `<cwd>/uploads` |
| Docker | `UPLOAD_DIR=/app/uploads`, volume `./backend/uploads:/app/uploads` |
| Что в SQLite | только `stored_file_path`, не содержимое DICOM |
| После рестарта | файл остаётся на volume; повторный ML для `processing` читает тот же путь |

Имя файла: basename, символы `<>:"/\|?*` и NUL заменяются на `_`. Пустое имя становится `study.dcm`.

Путь в ответ API не входит. Файл не удаляется при `completed`, при `error` и при рестарте.

Два тома Compose нужны для сохранности: `backend/data` и `backend/uploads`. Общий том с контейнером `ml-service` не добавляется, пока backend не ходит в этот контейнер.

---

## 14. API contract

Новые endpoint'ы не создавать. Имена полей не менять.

Метаданные Study в JSON — camelCase: `sessionId`, `createdAt`, `updatedAt`, `originalFileName`, `hasResult`. Поля ML — snake_case: `quality_class`, `violation_type`, `quality_prob`, `anatomical_region`. В результате id называется `studyId`.

| Method | Endpoint | Назначение | Вход | Успех | Ошибки |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/studies` | создать исследование | multipart: обязательный `file`, необязательный `session_id` | 201, `status = processing`, без ожидания ML | 400, 413, 500 |
| GET | `/api/studies` | история | необязательный query `session_id` | 200, `{ items }` | 400 |
| GET | `/api/studies/:id` | статус Study | path UUID v4 | 200, объект статуса без полей ML | 400, 404 |
| GET | `/api/studies/:id/result` | результат | path UUID v4 | 200, валидный StudyResult, только при читаемом `completed` | 400, 404, 409 |
| GET | `/health` | процесс жив | нет | 200, `{ "status": "ok" }` | процесс недоступен, если сервер не запущен |
| GET | `/api/docs` | Swagger UI | нет | HTML | — |
| GET | `/api/docs-json` | OpenAPI JSON | нет | документ Swagger | — |

`GET /api/docs-json` уже появляется из `SwaggerModule.setup('api/docs', ...)`: свой `jsonDocumentUrl` не задан, путь по умолчанию — `api/docs-json`. Рядом тот же setup отдаёт `GET /api/docs-yaml`. Это не новый бизнес-endpoint. Удалять его и заводить отдельный контроллер не нужно.

Состояния для result:

| Study.status | `GET /api/studies/:id/result` |
| --- | --- |
| `processing` | 409 `RESULT_NOT_READY`, результата нет |
| `completed` и результат читается | 200, обязательны `quality_class`, `violation_type`, `anatomical_region` |
| `error` | 409 `ANALYSIS_FAILED` |

Swagger после реализации должен показывать `anatomical_region` обязательным полем успешного результата и `quality_prob` необязательным. Заголовок «RUEN API» и версия `0.3.0` не меняются этой спецификацией.

---

## 15. DTO

Новые классы под несуществующие сценарии не создавать. Отдельный class-validator DTO для `POST` не обязателен: файл принимает Multer, `session_id` проверяет сервис.

### POST `/api/studies`

| Поле | Тип | Обязательно |
| --- | --- | --- |
| `file` | бинарная часть | да |
| `session_id` | string, максимум 128 после trim | нет |

Response `CreateStudyResponseDto`: `id`, `status`, `createdAt`, `sessionId`.

### GET `/api/studies`

Request: `ListStudiesQueryDto`, необязательная строка `session_id`. Пустое значение и лимит 128 проверяет сервис.

Response `StudyListResponseDto`: `items` — массив `StudyStatusResponseDto`.

### GET `/api/studies/:id`

Path `id`, UUID версии 4.

`StudyStatusResponseDto`:

| Поле | В JSON |
| --- | --- |
| `id` | да |
| `sessionId` | да, допускается `null` |
| `status` | да: `processing`, `completed` или `error` |
| `originalFileName` | да |
| `createdAt` | да |
| `updatedAt` | да |
| `error` | да, допускается `null` |
| `hasResult` | да |

Поля ML в этот DTO не добавлять.

### GET `/api/studies/:id/result`

Path `id`, UUID версии 4.

`StudyResultResponseDto` успешного ответа:

| Поле | В JSON 200 | Validation до `completed` |
| --- | --- | --- |
| `studyId` | да | id исследования |
| `quality_class` | да, `0` или `1` | целое `0` или `1` |
| `violation_type` | да, string | `""` при классе `0`; допустимые фрагменты региона при классе `1` |
| `anatomical_region` | да | ровно один из двух регионов |
| `quality_prob` | нет | если пришёл от ML — число в `[0; 1]` |

Ошибки — `ApiErrorResponseDto`: `statusCode`, `error`, `code`, `message`, необязательный `status`.

Текущий `StudyResultResponseDto` и `MlPrediction` помечают `anatomical_region` необязательным. Для успешного результата спецификация считает его обязательным. Реализация обновляет описание Swagger и тип валидного результата. Колонку и имя поля не переименовывать.

---

## 16. State transitions

```text
                validation пройдена, result записан
processing -------------------------------------------> completed

                исключение ML или validation не пройдена
processing -------------------------------------------> error
```

| From | To | Одна запись SQLite |
| --- | --- | --- |
| — | `processing` | вставка: id, session, имя, путь, timestamps, `error = NULL`, колонки результата = `NULL` |
| `processing` | `completed` | статус, `updated_at`, `error = NULL`, все поля результата |
| `processing` | `error` | статус, `updated_at`, текст «Ошибка обработки ML.», колонки результата = `NULL` |

Перед записью конечного статуса строка читается снова. Если она уже не `processing`, запись не делается.

`UPSERT` не меняет `id`, `session_id`, `original_file_name`, `stored_file_path`, `created_at`.

Вызов ML внутри транзакции базы не держится. Атомарность относится к одному statement, который одновременно пишет статус и колонки результата. Текущий `ON CONFLICT DO UPDATE` уже обновляет эти поля вместе. Этот подход сохранить.

Инвариант закоммиченной строки:

```text
status = completed  <=>  результат читается по разделу 3.1
status = processing <=>  колонки результата пустые
status = error      <=>  колонки результата пустые
```

Обычный успешный сценарий не допускает `completed` без результата и не допускает результат при `processing`.

Если statement после успешного ML не записался, в базе остаётся прежний `processing`. `completed` без результата при этом не появляется. После restart эта строка снова идёт в ML.

---

## 17. Edge cases

| Ситуация | Поведение |
| --- | --- |
| Несколько исследований в `processing` | у каждого свой `id`, файл и строка. Общего mutable-состояния нет. Очередь не создаётся |
| ML одного исследования упал | остальные не переводятся в `error` |
| Повторный проход, когда статус уже конечный | запись не меняется |
| Restart при `processing` | ML вызывается снова |
| Restart при `completed` или `error` | данные те же, ML не вызывается |
| Невалидный ответ ML | конечный `error`, без повтора после restart |
| Исключение ML | тот же `error` и тот же внешний текст |
| `GET result` при `processing` | 409 `RESULT_NOT_READY` |
| `GET result` при `error` | 409 `ANALYSIS_FAILED` |
| `GET :id` при `error` | 200 и поле `error` |
| Неизвестный id | 404 |
| id не UUID v4 | 400 |
| Пустая история | 200, `items: []` |
| `session_id` из пробелов | как отсутствие сессии |
| Одинаковый `created_at` | порядок по `id DESC` |
| `quality_prob` не пришёл | ключа нет в JSON, это валидно |
| `quality_prob` вне `[0; 1]` или не число | `error`, результат не сохраняется |
| Нет `anatomical_region` или значение вне двух строк | `error` |
| Класс `0` и непустой `violation_type` | `error` |
| Класс `1` и пустой `violation_type` | `error` |
| Нарушение не из списка этого региона | `error` |
| Пробел после `;` или повтор фрагмента | `error` |
| Вызов ML завис без исключения | строка остаётся `processing`. Числовой timeout не вводится |
| Два процесса backend на одном файле SQLite | не целевой режим |
| Ошибка записи файла | 500, строки нет |
| Файл больше 50 МБ | 413 до создания строки |
| Не DICOM по имени/MIME | 400 до создания строки |
| Ручное удаление файла при `processing` | повторный ML после restart завершится `error`, если клиент бросит исключение. Автоочистку не добавлять |

---

## 18. Definition of Done

```text
[ ] POST /api/studies с одним DICOM создаёт строку и возвращает 201 processing, не дожидаясь ML
[ ] id — UUID v4
[ ] session_id сохраняется и возвращается как sessionId; пустое значение сохраняется как null
[ ] session_id длиннее 128 символов даёт 400 и не создаёт строку
[ ] Формат UUID у session_id backend не требует; пользователей и JWT нет
[ ] Файл лежит в UPLOAD_DIR/<id>/..., путь в API не отдаётся
[ ] Непринятый файл даёт 400 или 413 и не создаёт исследование
[ ] Сбой записи файла или INSERT даёт 500 без stack trace и без доступной строки
[ ] ML вызывается с studyId, filePath, originalFileName и без pixel scale
[ ] До completed выполняются structural и business validation
[ ] quality_class принимает только целое 0 или 1
[ ] quality_prob можно не передавать; переданное значение только число в [0; 1]
[ ] anatomical_region обязателен и равен одному из двух регионов
[ ] violation_type при классе 0 равен ""
[ ] violation_type при классе 1 — один или несколько точных фрагментов этого региона через ";"
[ ] Нарушение другого региона, пустой фрагмент, пробел у разделителя и повтор фрагмента не проходят validation
[ ] Невалидный ответ записывается как error с текстом «Ошибка обработки ML.» и пустым результатом
[ ] Исключение ML даёт тот же error и тот же текст
[ ] error и completed после restart в ML не отправляются
[ ] processing после restart отправляется в ML снова
[ ] completed и результат пишутся одним statement
[ ] error и очистка результата пишутся одним statement
[ ] Нет закоммиченных пар completed без результата и processing с результатом
[ ] GET /api/studies/:id при processing возвращает 200 и hasResult false
[ ] GET /api/studies/:id/result при processing возвращает 409 RESULT_NOT_READY
[ ] GET /api/studies/:id при error возвращает 200 и поле error
[ ] GET /api/studies/:id/result при error возвращает 409 ANALYSIS_FAILED
[ ] Успешный result содержит studyId, quality_class, violation_type и anatomical_region
[ ] quality_prob в JSON отсутствует, если ML его не вернул
[ ] Неизвестный id даёт 404
[ ] История без session_id возвращает все исследования
[ ] История с session_id возвращает только эту сессию
[ ] Пустая история — 200 и items: []
[ ] Сортировка created_at DESC, id DESC; пагинации нет
[ ] Restart сохраняет SQLite, результаты, session_id и файлы
[ ] Параллельные исследования не делят общее mutable-состояние
[ ] uploaded не записывается и из CHECK не удаляется
[ ] PixelSpacing и размеры пикселя не пишутся в базу и не добавляются в запрос ML
[ ] Swagger /api/docs и /api/docs-json совпадают с контрактом, anatomical_region в успешном результате обязателен
[ ] Тесты покрывают валидный результат, невалидный ответ как error, исключение ML, 409 при processing, фильтр истории и restart для processing, completed и error
```

---

## 19. Закрытые решения

Раздела открытых вопросов больше нет.

### 1. Закрытые списки региона и нарушений

Решение: backend проверяет и `anatomical_region`, и фрагменты `violation_type` по закрытым спискам раздела 7.5. Другие значения невалидны. Несколько нарушений записываются как `Нарушение 1;Нарушение 2`. Пустая строка допустима только при `quality_class = 0`.

### 2. Связка `quality_class` и `violation_type`

Решение: класс `0` требует `violation_type = ""`. Класс `1` требует непустой `violation_type` из допустимых нарушений того `anatomical_region`, который пришёл в ответе. Обе запрещённые комбинации из постановки, а также нарушение не своего региона, переводят исследование в `error`.

### 3. Timeout

Решение: числовой бизнес-timeout не вводится. Итог определяет завершение или исключение ML-клиента. Технический timeout будущей библиотеки бизнес-правилом не считается; если он проявится исключением, исследование получает тот же `error`.

### `anatomical_region` в контракте ответа

Текущий код считает поле необязательным. Для валидного результата оно обязательное, потому что набор нарушений выбирается по региону. Успешный `StudyResultResponseDto` всегда содержит `anatomical_region`. `quality_prob` остаётся необязательным.

---

## 20. Расхождения с текущим кодом

Эти пункты не исправлены в коде. Их реализует Karina.

| Область | SPEC | Текущий код | Расхождение |
| --- | --- | --- | --- |
| Statuses | Рабочие статусы `processing`, `completed`, `error`. `uploaded` не используется и не удаляется из `CHECK` | `StudyStatus` и `CHECK` содержат `uploaded`. Сервис пишет только три рабочих статуса. Restart вызывает ML только для `processing` | Расхождения поведения нет. `uploaded` не удалять |
| ML validation | До `completed`: тип и значение `quality_class`, диапазон `quality_prob`, обязательный регион, словарь нарушений, связка класса и текста. Иначе `error` | `processStudy` записывает объект клиента в результат без проверки. Исключение клиента уже даёт `error` | Проверки ответа нет. Невалидный `quality_class` ломает `CHECK` SQLite, внешний catch оставляет `processing`, restart повторяет ML |
| `anatomical_region` | Обязателен в валидном результате и в JSON 200 | `MlPrediction.anatomical_region?` и `@ApiPropertyOptional` в `StudyResultResponseDto`. `getResult` опускает пустое поле | Контракт успешного ответа надо сделать обязательным. Колонку не добавлять |
| `quality_prob` | Необязателен; если есть — число в `[0; 1]`, иначе `error` | Поле необязательно и пишется как пришло, диапазон не проверяется | Нет проверки диапазона и типа |
| `violation_type` | Пустая строка только при классе `0`; при классе `1` — точные фрагменты региона через `;` | Любая строка сохраняется. Словарь и связка с классом не проверяются | Нет business validation |
| session_id | Строка до 128 символов, без auth и без проверки UUID | `normalizeSessionId` уже так делает | Расхождения нет. Не ужесточать |
| History | `GET /api/studies` без фильтра — все; с `session_id` — одна сессия. Без пагинации и без сущности History | `findAll` и индекс `session_id` уже так работают. Сортировка `created_at DESC, id DESC` | Расхождения нет |
| Error handling | Ошибки HTTP текущие. Ошибка анализа: статус `error`, текст «Ошибка обработки ML.», result пустой, `GET result` → 409 | Исключение ML уже так обрабатывается. Невалидный ответ до этого пути не доходит | Для validation использовать тот же текст и тот же 409, не новый код ошибки |
| Restart | `processing` повторить; `completed` и `error` не повторять | `onModuleInit` уже вызывает `processStudy` только для `processing` | Поведение верное. После validation невалидный ответ должен стать `error`, чтобы restart его не повторял |
| API | Те же маршруты, включая `GET /health`, `GET /api/docs`, `GET /api/docs-json`. `POST` → 201 `processing`. Result при `processing` недоступен | Контроллер и Swagger setup уже такие. `docs-json` — путь по умолчанию Nest | Маршруты не менять. В OpenAPI успешный result должен требовать `anatomical_region` |
| SQLite | Та же таблица `studies`, результат в той же строке, один statement на статус и колонки результата | `SqliteStudyRepository` уже хранит результат в `studies` и обновляет статус вместе с колонками результата | Схему не менять. Проверку списков делать в приложении, не новым `CHECK` |
| Тесты | Невалидный ответ ожидает `error` и отсутствие повтора после restart | `studies.service.spec.ts` считает успешным ответ без `anatomical_region` (`quality_class`, `violation_type`, иногда `quality_prob`) | Эти заглушки после validation станут `error`. Тесты привести к SPEC, не ослабляя проверку |

Текущий `MockMlClient` уже возвращает валидную комбинацию класса `0`, пустого `violation_type` и региона поясничного отдела. Его ответ менять не нужно.

---

## IMPLEMENTATION CHECKLIST

```text
[ ] Реализовать ML response validation
[ ] Реализовать validation quality_class
[ ] Реализовать validation quality_prob
[ ] Реализовать validation anatomical_region
[ ] Реализовать validation violation_type
[ ] Реализовать cross-field validation quality_class ↔ violation_type
[ ] Невалидный ML response переводит Study в error
[ ] ML exception переводит Study в error
[ ] Error не перезапускается после restart
[ ] Processing может повторно обрабатываться после restart
[ ] Completed не перезапускается
[ ] Сохранить session_id
[ ] Сохранить history filtering
[ ] Сохранить текущий API contract
[ ] Сохранить SQLite persistence
[ ] Не добавлять authentication
[ ] Не добавлять новые product features
[ ] Успешный StudyResult всегда содержит anatomical_region
[ ] quality_prob остаётся необязательным
[ ] Невалидный ответ не остаётся processing из-за исключения CHECK SQLite
[ ] Обновить тесты, которые считают валидным ответ ML без региона и без проверки словаря
[ ] Swagger успешного result показывает anatomical_region обязательным
```

Пункты про session, history, API routes, SQLite, restart конечных статусов и текст ошибки при исключении ML уже выполнены текущим кодом. Их нужно сохранить. Обязательное изменение — validation до `completed` и тесты, которые фиксируют новый отказ.

## OUT OF SCOPE

```text
[ ] Frontend
[ ] UI
[ ] Authentication
[ ] Users
[ ] PostgreSQL
[ ] Redis
[ ] Queues
[ ] Pagination
[ ] Retry policy
[ ] Automatic file deletion
[ ] Новые ML outputs
[ ] Числовой timeout ML
[ ] Удаление uploaded из CHECK
[ ] Передача pixel_x_mm / pixel_y_mm в ML request
[ ] Чтение DICOM PixelSpacing
[ ] Отдельная таблица StudyResult
```
