FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 libgl1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# CPU-колёса PyTorch. Повторная установка torch из PyPI заменила бы их на тяжёлый CUDA-пакет.
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch torchvision \
    && pip install --no-cache-dir pydicom opencv-python numpy pandas scikit-learn joblib

COPY src ./src
COPY models ./models

ENV PYTHONPATH=/app/src
ENV PYTHONUNBUFFERED=1
ENV MODEL_DIR=/app/models
ENV ML_HOST=0.0.0.0
ENV ML_PORT=8000

EXPOSE 8000

CMD ["python", "-m", "inference.server"]
