# Комплект сдачи

Хакатон ЛЦТ 2026, направление «Город». Задача: AI-сервис оценки качества исследований плотности костей.

Постановщик: Департамент здравоохранения Москвы, Центр диагностики и телемедицины.

Оглавление: [README.md](../README.md).

## Команда

Команда: АУРА. Состав и зоны ответственности: [team.md](team.md).

## Репозиторий

Публичный репозиторий: https://github.com/mister-kaka/bonecheck-ai

Исходный код интерфейса и API лежит в этом репозитории. Личные пароли для доступа не используются. В текущей версии модель не подключена: [limitations.md](../product/limitations.md), [ml/README.md](../ml/README.md).

Медицинские изображения в репозиторий не входят. Для проверки система принимает DICOM локально.

## Документация

Точка входа в репозиторий: [README.md](../../README.md). Оглавление документов: [docs/README.md](../README.md).

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
| Соответствие задаче | [requirements.md](requirements.md) |
| Ограничения | [limitations.md](../product/limitations.md) |
| Короткие ответы | [faq.md](../product/faq.md) |

## Презентация

Презентация в репозиторий не входит. За неё отвечает Саша. По формату защиты: около 5 минут презентации и ответы на вопросы. Защищаются команды после первичной верификации.

## Прототип

Рабочий прототип - запущенное приложение.

1. Запустить систему по [running.md](../system/running.md).
2. Открыть http://localhost:5173.
3. Загрузить DICOM или ZIP.
4. Открыть результат, снимок, «Историю» и XLSX.

Проверка API: http://localhost:3000/health и http://localhost:3000/api/docs.

## Дополнительные материалы

Проверки: [testing.md](../system/testing.md).
