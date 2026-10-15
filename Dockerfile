# Stage 1: Build dependencies cleanly
FROM python:3.11-slim AS builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Final lightweight native sandboxed execution container
FROM python:3.11-slim AS runner

WORKDIR /app
# Grab built dependencies from the builder layer
COPY --from=builder /root/.local /root/.local
COPY ai_integration.py cli_chat.py ./

ENV PATH=/root/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1

# Run the interactive CLI app engine
ENTRYPOINT ["python", "cli_chat.py"]
