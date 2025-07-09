# Container Optimization Guide

## Overview

This document details the optimizations applied to the Cloudflare Workers container to ensure reliable operation and efficient resource usage.

## Startup Optimization

### The Race Condition Problem
Cloudflare Workers containers must start listening on their designated port within ~400ms. The original implementation had this sequence:

1. Module loads
2. ~1300 lines of function definitions parsed
3. HTTP server created
4. server.listen() called

This took ~1.9 seconds, causing Cloudflare to cancel requests before the container was ready.

### The Solution: Early Port Binding
The container now implements early port binding:

```typescript
// At the top of main.ts, immediately after imports
const server = http.createServer(temporaryHandler);
server.listen(PORT, () => {
  console.log(`Port ${PORT} bound in ${Date.now() - startTime}ms`);
});

// Real request handler assigned after initialization
requestHandler = requestHandlerImpl;
```

This ensures the port is bound within the first 50-100ms, passing Cloudflare's readiness checks.

## Memory Optimization

### Container Instance Types
Cloudflare Workers containers support different instance types:

- `dev` (default): 256 MiB memory
- `basic`: 1 GiB memory ✅ (Currently used)
- `standard`: 2 GiB memory
- `professional`: 4 GiB memory

### Configuration
Set in `wrangler.jsonc`:

```json
"containers": [{
  "class_name": "MyContainer",
  "image": "./Dockerfile",
  "instance_type": "basic"
}]
```

The container requires the "basic" instance type due to:
- Claude Code SDK overhead
- Python runtime requirements
- Git operations memory usage

## Docker Image Optimization

### Multi-Stage Build
The Dockerfile uses a multi-stage build to minimize the final image size:

**Build Stage:**
- Includes all build tools (build-essential, python3-dev)
- Compiles TypeScript to JavaScript
- Installs all dependencies including devDependencies

**Production Stage:**
- Only runtime dependencies (python3, git, curl, ca-certificates)
- Production-only npm install (`npm ci --only=production`)
- Copies compiled code from build stage

### Size Reduction Results
- Original image: 1.27 GB
- Optimized image: 566 MB (55% reduction)

### Key Optimizations Applied
1. **Removed duplicate Claude Code CLI** - Use only local npm dependency
2. **Eliminated build tools** from production image
3. **Optimized npm installation** - Production-only with cache cleanup
4. **Minimal runtime packages** - Only essential system packages

## Performance Monitoring

### Container Startup Metrics
Monitor these key metrics:
- Port binding time (should be < 100ms)
- Total initialization time
- Memory usage at startup
- First request handling time

### Logging for Diagnostics
The container logs detailed timing information:

```
[CONTAINER_STARTUP] Container starting...
[CONTAINER_STARTUP] Server listening on port (bindTimeMs: 47ms)
[CONTAINER_STARTUP] Request handler assigned, container ready
```

## Troubleshooting

### Common Issues

1. **"Container is not listening" errors**
   - Cause: Port not bound within timeout
   - Solution: Ensure early port binding pattern is implemented

2. **Out of Memory (OOM) errors**
   - Cause: Insufficient memory allocation
   - Solution: Upgrade instance type in wrangler.jsonc

3. **Slow container startup**
   - Cause: Heavy initialization before port binding
   - Solution: Move initialization after server.listen()

### Debugging Commands

```bash
# Monitor container logs
npx wrangler tail --format=pretty

# Analyze Docker image size
./scripts/analyze-container-size.sh

# Test container locally
docker build -t test-container .
docker run -p 8080:8080 test-container
```

## Best Practices

1. **Always bind port first** - HTTP server should start listening immediately
2. **Use appropriate instance type** - Don't use default 256 MiB for complex containers
3. **Monitor startup times** - Add timing logs for debugging
4. **Optimize Docker layers** - Keep frequently changing code in later layers
5. **Use production dependencies** - Separate dev dependencies in package.json

## Future Improvements

1. **Pre-compiled containers** - Investigate shipping compiled JavaScript only
2. **Lazy loading** - Load heavy dependencies only when needed
3. **Connection pooling** - Reuse HTTP connections for API calls
4. **Workspace caching** - Cache git repositories between invocations