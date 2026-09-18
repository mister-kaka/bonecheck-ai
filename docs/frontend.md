# Frontend

Статус: **заглушка**. UX/UI в разработке у frontend-команды (лид - Саша). В репозитории макета Figma нет.

Не описывать экраны, которых нет в коде.

---

## Что есть (CONFIRMED)

Стек: React 19, TypeScript, Vite 7. Пакет: `ruen-frontend`.

```text
frontend/src/
├── main.tsx
├── App.tsx              # рендерит Home
├── pages/Home.tsx       # заголовок и placeholder статуса
├── api/client.ts        # VITE_API_BASE_URL
├── components/          # пусто
└── assets/              # пусто
```

`Home` показывает:

- заголовок `RUEN AI Densitometry`;
- текст «Статус сервиса:» и «Backend connection placeholder».

Загрузки файла, поллинга, экрана результата, роутинга и CSS-фреймворка нет.

`src/api/client.ts`:

```text
API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
```

Функций `fetch` / axios нет.

Запуск: [README.md](../README.md). Порт 5173.

---

## Контракт API

Когда UI начнёт ходить в backend, использовать только [api.md](api.md):

- `POST /api/studies`
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
- состав маршрутов;
- библиотека UI;
- как показывать несколько нарушений из строки с `;`;
- нужен ли просмотр самого DICOM в браузере.
