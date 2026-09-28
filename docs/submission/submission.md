# Комплект сдачи

Хакатон ЛЦТ 2026, направление «Город». Задача: AI-сервис оценки качества исследований плотности костей.

Постановщик: Департамент здравоохранения Москвы, Центр диагностики и телемедицины.

Оглавление: [README.md](../README.md).

## Команда

Команда: АУРА. Состав и зоны ответственности: [team.md](team.md).

## Ссылки

| Материал | Адрес |
| --- | --- |
| Репозиторий | https://github.com/mister-kaka/bonecheck-ai |
| Прототип | https://bonecheck-ai.onrender.com/ |
| API | https://bonecheck-backend.onrender.com |
| Описание API | https://bonecheck-backend.onrender.com/api/docs |
| Презентация | https://drive.google.com/drive/folders/1zlEBlKHtzzT_uzwYWin5M9-7FRvxSmvV?usp=sharing |
| Документация | https://drive.google.com/drive/folders/1Kmc9kUhgRQJAQj1I4TXELsZ0TAhWphzD?usp=sharing |
| Дополнительные материалы | https://drive.google.com/drive/folders/1IpQ52A42A0EOxw_bs1yTRJ9V7IUtbRfm?usp=sharing |

Исходный код интерфейса и API лежит в репозитории. Личные пароли для доступа не используются. В текущей версии модель не подключена: [limitations.md](../product/limitations.md), [ml/README.md](../ml/README.md).

Медицинские изображения в репозиторий не входят.

## Документация

Точка входа в репозиторий: [README.md](../../README.md). Оглавление документов: [docs/README.md](../README.md).

Назначение системы и границы текущего стенда: [product.md](../product/product.md), [limitations.md](../product/limitations.md).

| Что проверить | Документ |
| --- | --- |
| Что это за система | [product.md](../product/product.md) |
| Сценарий | [scenario.md](../product/scenario.md) |
| Результат и нарушения | [results.md](../product/results.md) |
| Запуск | [running.md](../system/running.md) |
| Docker | [deployment/README.md](../../deployment/README.md) |
| API | [api.md](../system/api.md) |
| Архитектура | [architecture.md](../system/architecture.md) |
| Модель | [ml/README.md](../ml/README.md) |
| Ограничения | [limitations.md](../product/limitations.md) |
| Короткие ответы | [faq.md](../product/faq.md) |

## Презентация

Папка презентации: https://drive.google.com/drive/folders/1zlEBlKHtzzT_uzwYWin5M9-7FRvxSmvV?usp=sharing

Презентация в репозиторий не входит. За неё отвечает Саша. По формату защиты: около 5 минут презентации и ответы на вопросы. Защищаются команды после первичной верификации.

## Прототип

Публичный прототип: https://bonecheck-ai.onrender.com/

1. Открыть https://bonecheck-ai.onrender.com/
2. Загрузить DICOM или ZIP.
3. Открыть результат, снимок, «Историю» и XLSX.

Проверка API: https://bonecheck-backend.onrender.com/health и https://bonecheck-backend.onrender.com/api/docs

Разделы «История» и карточка исследования - адреса `/history` и `/history/:id`. Статический хост должен отдавать на них `index.html`. Правило для Render: [deployment/README.md](../../deployment/README.md).

На публичном стенде файл уходит на API стенда. Это не локальная машина пользователя. Локальный и самостоятельный запуск описаны отдельно.

## Локальная проверка

Адреса ниже - машина, на которой запущены команды из [running.md](../system/running.md).

1. Запустить систему по [running.md](../system/running.md).
2. Открыть http://localhost:5173
3. Загрузить DICOM или ZIP.
4. Открыть результат, снимок, «Историю» и XLSX.

Проверка локального API: http://localhost:3000/health и http://localhost:3000/api/docs

## Дополнительные материалы

Общая папка проекта: https://drive.google.com/drive/folders/1IpQ52A42A0EOxw_bs1yTRJ9V7IUtbRfm?usp=sharing

Проверки: [testing.md](../system/testing.md).
