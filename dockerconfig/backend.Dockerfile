FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libglib2.0-0 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxkbcommon-x11-0 \
    libxcb1 \
    libx11-6 \
    libxext6 \
    libxrender1 \
    libxi6 \
    libsm6 \
    libice6 \
    libegl1 \
    libgl1 \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server_config.txt /app/server_config.txt
COPY . .

ENV PYTHONUNBUFFERED=1
ENV QT_QPA_PLATFORM=offscreen

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
