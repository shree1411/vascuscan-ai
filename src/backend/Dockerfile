FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for scipy, numpy, and pyserial
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port (Render sets PORT env variable, defaulting to 5005)
EXPOSE 5005

# Command to run the application
CMD ["uvicorn", "app.main:main_app", "--host", "0.0.0.0", "--port", "5005"]
