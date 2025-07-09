# syntax=docker/dockerfile:1

# Build stage - includes build tools
FROM node:22-slim AS builder

# Install minimal build dependencies for compilation only
RUN apt-get update && \
    apt-get install -y \
        python3 \
        git \
        build-essential \
        ca-certificates \
        curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install ALL dependencies (including dev)
COPY container_src/package*.json ./
RUN npm install

# Copy TypeScript configuration and source
COPY container_src/tsconfig.json ./
COPY container_src/src/ ./src/

# Build TypeScript
RUN npm run build

# Production stage - minimal runtime
FROM node:22-slim AS production

# Install ONLY runtime dependencies (no build tools)
RUN apt-get update && \
    apt-get install -y \
        python3 \
        git \
        ca-certificates \
        curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install ONLY production dependencies
COPY container_src/package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

EXPOSE 8080

# Run the compiled JavaScript
CMD ["node", "dist/main.js"]