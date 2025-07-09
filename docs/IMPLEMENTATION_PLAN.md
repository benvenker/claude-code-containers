# Implementation Plan: Fix Container Startup Race Condition

## Approach: Minimal Changes to main.ts

Instead of a major refactor, we'll make minimal changes to ensure the port binds within the first 100ms:

### Current Structure (SLOW):
```
1. Imports
2. Module-level startup log
3. Type definitions (lines 22-88)
4. Function definitions (lines 89-1310) 
5. Request handler (lines 1311-1375)
6. Server creation (line 1378)
7. Server.listen (line 1387) <- This happens too late!
```

### New Structure (FAST):
```
1. Imports
2. Create server and start listening IMMEDIATELY
3. Rest of the code remains the same
```

## Implementation Steps

### Step 1: Move Server Creation to Top

After imports and PORT definition, immediately create and start the server:

```typescript
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;

// Create server immediately but with a temporary handler
const server = http.createServer((req, res) => {
  // Will be replaced once main handler is defined
  handleEarlyRequest(req, res);
});

// Start listening within first few milliseconds
server.listen(PORT, () => {
  const address = server.address();
  console.log('[CONTAINER_STARTUP] Port opened immediately', {
    port: PORT,
    address: address,
    timestamp: new Date().toISOString()
  });
});

// Temporary handler for early requests
function handleEarlyRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  // If we get a request before initialization, handle it gracefully
  if (typeof requestHandler === 'function') {
    return requestHandler(req, res);
  }
  
  // Return 503 if not ready yet
  res.writeHead(503, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    status: 'initializing',
    message: 'Container starting up'
  }));
}

// ... rest of the existing code ...

// At the end, update the server handler to use the real one
server.removeAllListeners('request');
server.on('request', requestHandler);
```

### Step 2: Test the Changes

1. The server should bind to port within 50ms
2. Early requests get 503 response
3. Once initialized, requests work normally

### Step 3: Minimal Diff

The changes are:
- Move server creation from line 1378 to ~line 20
- Move server.listen from line 1387 to ~line 25  
- Add a temporary handler
- Update handler at the end

This preserves all existing code logic while fixing the race condition.

## Risk Assessment

- **Low Risk**: All existing code remains unchanged
- **Backwards Compatible**: Same behavior once initialized
- **Fail-Safe**: Early requests get 503 instead of hanging

## Alternative: Even Simpler Fix

If we want the absolute minimal change, we could just move these two lines to the top:

```typescript
const server = http.createServer(requestHandler);
server.listen(PORT, callback);
```

But this requires `requestHandler` to be defined first, which means either:
1. Forward declaration with `let requestHandler: any;`
2. Moving the function definition up

Both are slightly more invasive than the temporary handler approach.