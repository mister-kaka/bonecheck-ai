# BoneCheck AI

Сервис оценки качества укладки DXA-исследований.

ЛЦТ 2026, направление «Город». Постановщик — Департамент здравоохранения Москвы, Центр диагностики и телемедицины.

Репозиторий: https://github.com/mister-kaka/bonecheck-ai

BoneCheck AI проверяет, пригоден ли снимок плотности кости по качеству укладки и полноте визуализации области. Система не ставит диагноз и не измеряет минеральную плотность кости.

## Для кого

Для врача-рентгенолога и сотрудника диагностического отделения, которому нужно увидеть результат проверки укладки до использования исследования.

## Что анализируется

DXA-снимки двух областей:

- поясничный отдел позвоночника;
- проксимальный отдел бедра.

Входной файл — DICOM.

## Основной сценарий

1. Открыть раздел «Анализ».
2. Загрузить один DICOM или один ZIP.
3. Дождаться проверки.
4. Посмотреть результат: укладка корректна или найдено нарушение.
5. Открыть снимок, перейти в историю или выгрузить XLSX.

Каждый снимок в архиве проверяется отдельно. Подробнее: [docs/scenario.md](docs/scenario.md).

## Входные данные

| Формат | Ограничение |
| --- | --- |
| `.dcm`, `.dicom` | один файл, до 50 МБ |
| `.zip` | один архив, до 50 МБ; внутри только DICOM |

## Что получает пользователь

- класс качества: корректная укладка или нарушение;
- анатомическая область;
- список найденных нарушений;
- вероятность нарушения, если она есть в результате;
- просмотр снимка;
- файл XLSX.

## Возможности

- загрузка DICOM и ZIP;
- проверка файла до начала анализа;
- статус обработки;
- результат по закрытому списку нарушений;
- просмотр снимка;
- история «Мои» и «Все» с поиском, фильтрами и страницами;
- карточка исследования;
- экспорт XLSX;
- сообщения об ошибках файла и анализа.

Описание продукта: [docs/product.md](docs/product.md).

## Запуск

Нужны Node.js 20 и npm. Для запуска одной командой — Docker.

Локально, из корня репозитория:

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

Docker, из корня репозитория:

```bash
docker compose up --build
```

Полная инструкция: [docs/running.md](docs/running.md). Контейнеры: [deployment/README.md](deployment/README.md).

## Документация

| Документ | О чём |
| --- | --- |
| [docs/product.md](docs/product.md) | назначение, аудитория, возможности |
| [docs/scenario.md](docs/scenario.md) | путь пользователя |
| [docs/results.md](docs/results.md) | классы качества и нарушения |
| [docs/files.md](docs/files.md) | DICOM и ZIP |
| [docs/interface.md](docs/interface.md) | экраны |
| [docs/architecture.md](docs/architecture.md) | устройство системы |
| [docs/api.md](docs/api.md) | HTTP API |
| [docs/data.md](docs/data.md) | что хранится |
| [docs/running.md](docs/running.md) | установка и запуск |
| [deployment/README.md](deployment/README.md) | Docker |
| [docs/testing.md](docs/testing.md) | проверки |
| [docs/errors.md](docs/errors.md) | ошибки |
| [docs/limitations.md](docs/limitations.md) | границы продукта |
| [docs/requirements.md](docs/requirements.md) | соответствие задаче |
| [docs/faq.md](docs/faq.md) | короткие ответы |
| [docs/submission.md](docs/submission.md) | комплект сдачи |
| [docs/team.md](docs/team.md) | команда |
| [docs/ml/README.md](docs/ml/README.md) | ML-компонент |
