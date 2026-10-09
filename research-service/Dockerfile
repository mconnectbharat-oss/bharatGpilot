FROM python:3.11-slim AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends build-essential gcc \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN python -m pip install --upgrade pip && python -m pip wheel --wheel-dir /wheels -r requirements.txt

FROM python:3.11-slim AS runner
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app
RUN groupadd --system --gid 8888 appuser && useradd --system --uid 8888 --gid appuser --home-dir /nonexistent --shell /usr/sbin/nologin appuser
COPY --from=builder /wheels /wheels
COPY requirements.txt .
RUN python -m pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt \
    && rm -rf /wheels /root/.cache
COPY --chown=appuser:appuser src/ ./src/
COPY --chown=appuser:appuser main.py .
USER 8888:8888
EXPOSE 4000
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "4000", "--workers", "1"]
