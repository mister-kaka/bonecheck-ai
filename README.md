# BoneCheck AI

Сервис проверки качества укладки DXA-исследований.

ЛЦТ 2026, направление «Город». Постановщик - Департамент здравоохранения Москвы, Центр диагностики и телемедицины.

Команда: АУРА.

Репозиторий: https://github.com/mister-kaka/bonecheck-ai

Публичный прототип: https://bonecheck-ai.onrender.com/

Презентация: https://drive.google.com/drive/folders/1zlEBlKHtzzT_uzwYWin5M9-7FRvxSmvV?usp=sharing

Документация: https://drive.google.com/drive/folders/1Kmc9kUhgRQJAQj1I4TXELsZ0TAhWphzD?usp=sharing

Общая папка проекта: https://drive.google.com/drive/folders/1IpQ52A42A0EOxw_bs1yTRJ9V7IUtbRfm

## Что это

Сервис реализует полный цикл обработки исследований: загрузку DICOM, проверку укладки через ML-сервис, хранение результатов, просмотр, историю и экспорт.

BoneCheck AI предназначен для проверки качества укладки DXA-снимка и полноты визуализации области. Система не ставит диагноз и не измеряет минеральную плотность кости.

Для врача-рентгенолога и сотрудника диагностического отделения результат проверки укладки виден до того, как исследование пойдёт в работу.

Предусмотрены две области: поясничный отдел позвоночника и проксимальный отдел бедра. На вход подаётся один DICOM или один ZIP.

Результат проверки — класс качества, область и типы нарушений. Вероятность модель не возвращает. Границы: [docs/product/limitations.md](docs/product/limitations.md). Веса лежат в `ml/models/` и в git не входят.

## Что уже работает

- загрузка одного DICOM или одного ZIP;
- статус обработки и карточка исследования;
- просмотр снимка;
- история «Мои» и «Все»;
- экспорт XLSX: файл, дата, анатомическая область, результат, тип нарушения, вероятность и статус.

## Ограничения

- без файлов весов в `ml/models/` ML-процесс не стартует, исследование получает ошибку анализа;
- опубликованных метрик качества модели API не показывает;
- сервис не ставит диагноз и не считает минеральную плотность.

Подробнее: [docs/product/limitations.md](docs/product/limitations.md).

## Структура

| Каталог | Что внутри |
| --- | --- |
| `frontend/` | интерфейс, React и Vite |
| `backend/` | API, NestJS и SQLite |
| `ml/` | inference: `site_prediction`, тепловая карта, HTTP-сервис |
| `docs/` | документация продукта и системы |
| `deployment/` | запуск через Docker |
| `docker-compose.yml` | интерфейс, API и ML-сервис |

## Как проходит проверка

1. Открыть раздел «Анализ».
2. Загрузить один DICOM или один ZIP.
3. Дождаться проверки.
4. Посмотреть результат на экране: «Укладка корректна» или «Нарушение качества укладки».
5. Открыть снимок, перейти в историю или выгрузить XLSX.

Каждый снимок в архиве - отдельное исследование. Подробнее: [docs/product/scenario.md](docs/product/scenario.md).

## Быстрый запуск

Нужны Node.js 20 и npm. Одной командой проект поднимается через Docker.

Из корня репозитория:

```powershell
Copy-Item .env.example .env
```

```bash
cp .env.example .env
```

API:

```bash
cd backend
npm install
npm run start:dev
```

Интерфейс, во втором терминале:

```bash
cd frontend
npm install
npm run dev
```

- интерфейс: http://localhost:5173
- API: http://localhost:3000
- проверка API: http://localhost:3000/health
- описание API: http://localhost:3000/api/docs

Docker, из корня репозитория:

```bash
docker compose up --build
```

По умолчанию открываются те же адреса. Порт `8000` контейнера `ml-service` в браузере не открывают: его вызывает API.

Полная инструкция: [docs/system/running.md](docs/system/running.md). Контейнеры: [deployment/README.md](deployment/README.md).

## Документация

Оглавление: [docs/README.md](docs/README.md).

- [О проекте](docs/product/product.md)
- [Пользовательский сценарий](docs/product/scenario.md)
- [Результат анализа](docs/product/results.md)
- [Ограничения](docs/product/limitations.md)
- [Архитектура](docs/system/architecture.md)
- [API](docs/system/api.md)
- [Запуск](docs/system/running.md)
- [Тестирование](docs/system/testing.md)
- [Материалы для сдачи](docs/submission/submission.md)
- [Команда](docs/submission/team.md)
