# syntax=docker/dockerfile:1

FROM node:22-slim AS base

# Update package lists and install dependencies
RUN apt-get update && \
    apt-get install -y \
        python3 \
        python3-pip \
        git \
        build-essential \
        python3-dev \
        ca-certificates \
        curl && \
    rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Install GitLab CLI (glab)
# Using the official installation script for Linux
RUN curl -sL https://gitlab.com/gitlab-org/cli/-/releases/permalink/latest/downloads/glab_Linux_x86_64.tar.gz | \
    tar -xz -C /tmp && \
    mv /tmp/bin/glab /usr/local/bin/ && \
    chmod +x /usr/local/bin/glab && \
    rm -rf /tmp/bin

# Set destination for COPY
WORKDIR /app

# Copy package files first for better caching
COPY container_src/package*.json ./

# Install npm dependencies
RUN npm install

# Copy TypeScript configuration
COPY container_src/tsconfig.json ./

# Copy source code
COPY container_src/src/ ./src/

# Build TypeScript
RUN npm run build

EXPOSE 8080

# Run the compiled JavaScript
CMD ["node", "dist/main.js"]