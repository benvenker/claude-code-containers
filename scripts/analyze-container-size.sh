#!/bin/bash

echo "🔍 Analyzing Docker image sizes step by step..."

# Create a minimal test Dockerfile to check base image size
cat > scripts/Dockerfile.analyze << 'EOF'
FROM node:22-slim AS step1
RUN echo "Base image size check"

FROM node:22-slim AS step2
RUN apt-get update && \
    apt-get install -y \
        python3 \
        python3-pip \
        git \
        build-essential \
        ca-certificates \
        curl \
        wget && \
    rm -rf /var/lib/apt/lists/*

FROM step2 AS step3
RUN npm install -g @anthropic-ai/claude-code

FROM step3 AS step4
WORKDIR /app
COPY container_src/package*.json ./
RUN npm install

FROM step4 AS step5
COPY container_src/tsconfig.json ./
COPY container_src/src/ ./src/
RUN npm run build
EOF

echo "📊 Building and analyzing each step..."

echo "Step 1: Base node:22-slim image"
docker build --target step1 -t analyze:step1 -f scripts/Dockerfile.analyze . 2>/dev/null
docker images analyze:step1 --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"

echo -e "\nStep 2: + System packages (python3, git, build-essential, etc.)"
docker build --target step2 -t analyze:step2 -f scripts/Dockerfile.analyze . 2>/dev/null
docker images analyze:step2 --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"

echo -e "\nStep 3: + Claude Code CLI"
docker build --target step3 -t analyze:step3 -f scripts/Dockerfile.analyze . 2>/dev/null
docker images analyze:step3 --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"

echo -e "\nStep 4: + Container npm dependencies" 
docker build --target step4 -t analyze:step4 -f scripts/Dockerfile.analyze . 2>/dev/null
docker images analyze:step4 --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"

echo -e "\nStep 5: + Built TypeScript code"
docker build --target step5 -t analyze:step5 -f scripts/Dockerfile.analyze . 2>/dev/null
docker images analyze:step5 --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"

echo -e "\n🧹 Cleaning up analysis images..."
docker rmi analyze:step1 analyze:step2 analyze:step3 analyze:step4 analyze:step5 2>/dev/null

echo -e "\n📋 Let's also check what Claude Code CLI actually installs:"
docker run --rm node:22-slim sh -c "npm list -g @anthropic-ai/claude-code --depth=0 2>/dev/null || npm info @anthropic-ai/claude-code"

rm scripts/Dockerfile.analyze

echo -e "\n💡 Analysis complete! This will show us where the bloat is coming from."