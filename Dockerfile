# Use Python 3.13 slim as the base image
FROM python:3.13-slim

# Install system dependencies
# - curl & git: for fetching repos and tools
# - nodejs/npm: required to run GitHub MCP server (via npx)
# - ruby-full & build-essential: required for Jekyll and compiling gems with native extensions
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    ruby-full \
    libffi-dev \
    && gem install bundler \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set up the workspace
WORKDIR /workspace

# Copy requirements.txt to install python packages
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy the daemon script
COPY agent_daemon.py /app/agent_daemon.py

# Configure container variables
ENV PYTHONUNBUFFERED=1
ENV AGENT_WATCH_DIR=/workspace
ENV AGENT_CACHE_DIR=/root/.gemini/muninn-agent-cache

# Run the agent daemon
CMD ["python", "/app/agent_daemon.py"]
