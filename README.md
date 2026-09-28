# BoneCheck AI

Сервис оценки качества укладки DXA-исследований.

ЛЦТ 2026, направление «Город». Постановщик - Департамент здравоохранения Москвы, Центр диагностики и телемедицины.

Репозиторий: https://github.com/mister-kaka/bonecheck-ai

## Что это

BoneCheck AI оценивает качество укладки DXA-снимка и полноту визуализации области. Система не ставит диагноз и не измеряет минеральную плотность кости.

Для врача-рентгенолога и сотрудника диагностического отделения: результат проверки укладки виден до того, как исследование пойдёт в работу.

Предусмотрены две области: поясничный отдел позвоночника и проксимальный отдел бедра. На вход подаётся один DICOM или один ZIP.

## Как проходит проверка

1. Открыть раздел «Анализ».
2. Загрузить один DICOM или один ZIP.
3. Дождаться проверки.
4. Посмотреть результат: укладка корректна или найдено нарушение.
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
- API: http://localhost:3000/health
- описание API: http://localhost:3000/api/docs

Docker:

```bash
docker compose up --build
```

Полная инструкция: [docs/system/running.md](docs/system/running.md). Контейнеры: [deployment/README.md](deployment/README.md).

## Документация

Оглавление: [docs/README.md](docs/README.md).

- [О проекте](docs/product/product.md)
- [Пользовательский сценарий](docs/product/scenario.md)
- [Результат анализа](docs/product/results.md)
- [Архитектура](docs/system/architecture.md)
- [API](docs/system/api.md)
- [Запуск](docs/system/running.md)
- [Тестирование](docs/system/testing.md)
- [Требования задания](docs/submission/requirements.md)
- [Материалы для сдачи](docs/submission/submission.md)
