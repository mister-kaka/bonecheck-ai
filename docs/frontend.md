# Frontend

Статус: экраны главной и истории есть. Анализ и таблица истории идут с локальных моков, страницы API не вызывают. В репозитории макета Figma нет.

Не описывать экраны, которых нет в коде.

---

## Что есть (CONFIRMED)

Стек: React 19, TypeScript, Vite 7, React Router 7. Пакет: `ruen-frontend`.

```text
frontend/src/
├── main.tsx                 # BrowserRouter; при старте создаёт session_id
├── App.tsx                  # AppHeader и маршруты
├── pages/Home/Home.tsx      # один DICOM, локальный мок анализа и результата
├── pages/HistoryPage/       # фильтры и таблица
├── api/session.ts           # localStorage bonecheck_session_id
├── api/client.ts            # createStudy, listStudies
├── api/mapStudyResult.ts    # поля результата API -> текст на экране
├── components/              # хедер и блоки экранов
├── mocks/                   # история и справочники фильтров
└── styles/
```

Маршруты в `App.tsx`:

| Путь | Страница |
| --- | --- |
| `/` | `Home` |
| `/history` | `HistoryPage` |
| любой другой | редирект на `/` |

`Home` показывает заголовок «Анализ исследования», приём одного файла `.dcm` / `.dicom` до 50 МБ и состояния загрузки, анализа, результата и ошибки файла. Результат берётся из константы `MOCK_COMPLETED_RESULT` через `mapStudyResult`, не из `GET /api/studies/:id/result`.

`HistoryPage` показывает заголовок «История исследований», поиск, фильтры и таблицу по `mocks/history.ts`.

При первом открытии приложения `main.tsx` вызывает `getOrCreateSessionId()`: если в `localStorage` нет ключа `bonecheck_session_id`, записывается `crypto.randomUUID()`. Повторные загрузки страницы читают тот же идентификатор.

`createStudy(file)` отправляет этот `session_id` полем multipart вместе с файлом. `listMyStudies()` запрашивает `GET /api/studies?session_id=...`, `listAllStudies()` - список без фильтра. Страницы эти функции пока не вызывают.

CSS-фреймворка нет: свои `styles/tokens.css` и `styles/global.css`.

Запуск: [README.md](../README.md). Порт 5173.

---

## Контракт API

Когда UI начнёт ходить в backend, использовать только [api.md](api.md):

- `POST /api/studies` (поле `session_id`)
- `GET /api/studies` и `GET /api/studies?session_id=`
- `GET /api/studies/:id`
- `GET /api/studies/:id/result`
- `GET /health`

Не вызывать Python ML.

Поля результата для отображения: `quality_class`, `violation_type`, опционально `quality_prob`, `anatomical_region`.

Пока backend на mock, UI будет получать «корректное» исследование почти всегда. Это ожидаемо.

---

## Что на экране не из API

- анализ на главной - таймер и фиксированный мок, не `POST /api/studies`;
- история читает `mocks/history.ts`, не `GET /api/studies`;
- `DicomViewer` показывает загруженный снимок. Heatmap, контур и ключевые точки рисуются, только если эти данные переданы в `ResultBlock`. Главная их не передаёт;
- переключателя «Мои / Все» нет;
- несколько нарушений из `violation_type` режутся по `;` в `mapStudyResult`.

---

## TBD

- утверждённый макет: Figma в репозитории нет.
