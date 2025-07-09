import * as http from 'http';
import { promises as fs } from 'fs';
import { query, type SDKMessage } from '@anthropic-ai/claude-code';
import simpleGit from 'simple-git';
import * as path from 'path';
import { spawn } from 'child_process';
import { ContainerGitHubClient } from './github_client.js';
import { GitLabClient } from './gitlab_client.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
const startTime = Date.now();

console.log(`[FAST_STARTUP] Starting container at ${new Date().toISOString()}`);

// Track initialization state
let isInitialized = false;
let requestHandler: any = null;

// Create and start server IMMEDIATELY with a temporary handler
const server = http.createServer(async (req, res) => {
  if (!isInitialized) {
    // During initialization, return 503 Service Unavailable
    res.writeHead(503, { 
      'Content-Type': 'application/json',
      'Retry-After': '1'
    });
    res.end(JSON.stringify({ 
      status: 'initializing',
      message: 'Container is starting up, please retry in 1 second'
    }));
    return;
  }
  
  // Once initialized, use the real handler
  return requestHandler(req, res);
});

// Bind to port IMMEDIATELY - this should happen within milliseconds
server.listen(PORT, () => {
  const bindTime = Date.now() - startTime;
  console.log(`[FAST_STARTUP] Port ${PORT} bound after ${bindTime}ms`);
  
  // Now do the heavy initialization asynchronously
  initializeContainer().then(() => {
    const initTime = Date.now() - startTime;
    console.log(`[FAST_STARTUP] Container fully initialized after ${initTime}ms`);
  }).catch(error => {
    console.error('[FAST_STARTUP] Initialization failed:', error);
    process.exit(1);
  });
});

// Handle server errors
server.on('error', (error) => {
  console.error('[FAST_STARTUP] Server error:', error);
  process.exit(1);
});

// Async initialization function
async function initializeContainer() {
  console.log('[FAST_STARTUP] Loading main module...');
  
  try {
    // Dynamically import the main module with all the handlers
    const mainModule = await import('./main.js');
    requestHandler = mainModule.requestHandler;
    isInitialized = true;
    
    console.log('[FAST_STARTUP] Main module loaded successfully');
  } catch (error) {
    console.error('[FAST_STARTUP] Failed to load main module:', error);
    throw error;
  }
}

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('[FAST_STARTUP] Received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('[FAST_STARTUP] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[FAST_STARTUP] Received SIGINT, shutting down gracefully');
  server.close(() => {
    console.log('[FAST_STARTUP] Server closed');
    process.exit(0);
  });
});