import * as http from 'http';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;

console.log('[MINIMAL] Starting minimal server test');
console.log('[MINIMAL] PORT from env:', process.env.PORT);
console.log('[MINIMAL] Parsed PORT:', PORT);
console.log('[MINIMAL] Node version:', process.version);

const server = http.createServer((req, res) => {
  console.log('[MINIMAL] Request received:', req.url);
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Minimal server is running\n');
});

server.on('error', (error: any) => {
  console.error('[MINIMAL] Server error:', error);
  console.error('[MINIMAL] Error code:', error.code);
  console.error('[MINIMAL] Error stack:', error.stack);
  process.exit(1);
});

server.on('listening', () => {
  const address = server.address();
  console.log('[MINIMAL] Server listening on:', address);
});

console.log('[MINIMAL] About to call server.listen...');
server.listen(PORT, () => {
  const address = server.address();
  console.log('[MINIMAL] Server started successfully');
  console.log('[MINIMAL] Address:', address);
});

console.log('[MINIMAL] server.listen called, waiting for events...');