# ML

Каталог HTTP-сервиса локального inference.

Запуск из этой папки: зависимости из `requirements.txt`, переменная `PYTHONPATH=src`, веса в `ml/models/`, затем `python -m inference.server`. Сервис принимает DICOM на `POST /analyze` (`multipart/form-data`) и не читает каталог загрузок API.

Контракт, модели и обучение: [docs/ml/README.md](../docs/ml/README.md). Границы результата: [ограничения](../docs/product/limitations.md).
