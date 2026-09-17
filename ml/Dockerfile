FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
COPY src ./src
COPY models ./models
COPY notebooks ./notebooks

# Heavy ML libraries stay in requirements.txt for local/training installs.
# The placeholder image only needs the stdlib process so Compose can build.

EXPOSE 8000

CMD ["python", "src/app.py"]
