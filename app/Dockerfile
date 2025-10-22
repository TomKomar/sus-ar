FROM python:3.12-slim

# System basics
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install only what's needed
RUN pip install --no-cache-dir fastapi==0.115.0 uvicorn[standard]==0.30.6

# Copy app and static files
COPY main.py ./main.py
COPY public ./public

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
