FROM python:3.14-slim

WORKDIR /app

ENV MODEL_DIR=/app/models \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py risk_model.py ./
COPY models/ ./models/

EXPOSE 5000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5000"]