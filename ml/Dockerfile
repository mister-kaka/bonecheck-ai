FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 libgl1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Версии зафиксированы в requirements.txt. Torch ставится CPU-колёсами, без CUDA.
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY src ./src
COPY models ./models

ENV PYTHONPATH=/app/src
ENV PYTHONUNBUFFERED=1
ENV MODEL_DIR=/app/models
ENV ML_HOST=0.0.0.0
ENV ML_PORT=8000

EXPOSE 8000

CMD ["python", "-m", "inference.server"]
