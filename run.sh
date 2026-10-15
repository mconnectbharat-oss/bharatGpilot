bash
#!/bin/bash

# Ensure local runtime target keys are checked safely
if [ -z "$OPENROUTER_API_KEY" ] && [ -z "$HF_TOKEN" ]; then
    echo "⚠️  Warning: Neither OPENROUTER_API_KEY nor HF_TOKEN is exported in your terminal environment."
    echo "Please set them first (e.g., export HF_TOKEN='your_token') to ensure model routing functions correctly."
fi

echo "🚀 Building and spinning up BharatGpilot sandbox container..."

# Build and execute the container instantly, attaching the console keyboard streaming arrays
docker compose up --build
