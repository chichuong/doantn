FROM python:3.11-slim

WORKDIR /app

# Install libgomp1 required for LightGBM / scikit-learn
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --default-timeout=300 --retries 10 --no-cache-dir -r requirements.txt lightgbm

COPY . .

ENV PYTHONUNBUFFERED=1
ENV FORECAST_SERVICE_TOKEN=karat-local-dev-token

EXPOSE 8001

CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8001"]
