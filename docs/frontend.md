# Frontend

Статус: **заглушка**. UX/UI в разработке у frontend-команды (лид - Саша). В репозитории макета Figma нет.

Не описывать экраны, которых нет в коде.

---

## Что есть (CONFIRMED)

Стек: React 19, TypeScript, Vite 7, React Router 7. Пакет: `ruen-frontend`.

```text
frontend/src/
├── main.tsx                 # BrowserRouter; при старте создаёт session_id
├── App.tsx                  # AppHeader и маршруты
├── pages/Home.tsx           # заглушка главной
├── pages/HistoryPage.tsx    # заглушка истории
├── api/session.ts           # localStorage bonecheck_session_id
├── api/client.ts            # базовый URL, createStudy, listStudies
├── components/
│   ├── AppHeader.tsx        # навигация: Главная, История
│   ├── Button.tsx           # базовый компонент, страницы его не рендерят
│   ├── Card.tsx             # базовый компонент; Card.module.css пустой
│   └── Spinner.tsx          # пустой файл-заготовка, нигде не импортируется
├── styles/tokens.css
├── styles/global.css
└── assets/                  # пусто
```

Маршруты в `App.tsx`:

| Путь | Страница |
| --- | --- |
| `/` | `Home` |
| `/history` | `HistoryPage` |
| любой другой | редирект на `/` |

`Home` показывает:

- заголовок `RUEN AI Densitometry`;
- текст «Статус сервиса:» и «Backend connection placeholder».

`HistoryPage` показывает заголовок «История исследований» и текст, что таблица появится позже.

Страницы по-прежнему заглушки: формы загрузки и таблицы истории нет. При первом открытии приложения `main.tsx` вызывает `getOrCreateSessionId()`: если в `localStorage` нет ключа `bonecheck_session_id`, записывается `crypto.randomUUID()`. Повторные загрузки страницы читают тот же идентификатор.

`createStudy(file)` отправляет этот `session_id` полем multipart вместе с файлом. `listMyStudies()` запрашивает `GET /api/studies?session_id=...`, `listAllStudies()` — список без фильтра. Страницы эти функции пока не вызывают.

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

## Принято командой, ещё не в коде

Из плана работ (не из ТЗ и не из текущего UI):

- экраны: загрузка, ожидание анализа, результат, нарушения, ошибки;
- прототип допускается на моках до интеграции;
- визуальные пояснения / heatmap - преимущество, не факт, что попадут в MVP.

Статус этих экранов: **PLANNED**.

---

## TBD

- утверждённый макет;
- финальный набор экранов сверх заглушек `/` и `/history`;
- библиотека UI;
- как показывать несколько нарушений из строки с `;`;
- нужен ли просмотр самого DICOM в браузере.
