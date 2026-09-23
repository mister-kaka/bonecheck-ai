FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
COPY src ./src
COPY models ./models
COPY notebooks ./notebooks

# Тяжёлые библиотеки ML остаются в requirements.txt для локальной установки и обучения.
# Образ-заглушка использует только стандартную библиотеку, чтобы Compose мог собраться.

EXPOSE 8000

CMD ["python", "src/app.py"]
