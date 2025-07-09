/**
 * Test to verify HTTP server startup in container
 * This should FAIL initially because main.ts doesn't create an HTTP server
 */

import { jest } from '@jest/globals';
import * as http from 'http';
import { spawn } from 'child_process';
import * as path from 'path';

describe('Container HTTP Server Startup', () => {
  let serverProcess: any;
  
  afterEach(() => {
    // Clean up server process if it exists
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill();
    }
  });

  it('should start HTTP server on port 8080', async () => {
    // This test EXPECTS a server to be running, so it will FAIL
    const checkServer = () => new Promise<number>((resolve, reject) => {
      const req = http.request({
        host: 'localhost',
        port: 8080,
        path: '/health',
        method: 'GET',
        timeout: 1000
      }, (res) => {
        resolve(res.statusCode || 0);
      });
      
      req.on('error', (err) => {
        reject(err);
      });
      
      req.end();
    });
    
    // Expect server to respond with 200 status (this will fail)
    const status = await checkServer();
    expect(status).toBe(200);
  });

  it('should respond to health check endpoint', async () => {
    // This test EXPECTS a working health endpoint, so it will FAIL
    const healthCheck = () => new Promise<any>((resolve, reject) => {
      const req = http.request({
        host: 'localhost',
        port: 8080,
        path: '/health',
        method: 'GET',
        timeout: 1000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      
      req.on('error', (err) => {
        reject(err);
      });
      
      req.end();
    });
    
    const result = await healthCheck();
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.status).toBe('healthy');
  });

  it('should have request handler for /process-gitlab endpoint', async () => {
    // Test that the /process-gitlab endpoint WORKS (this will FAIL)
    const testEndpoint = () => new Promise<number>((resolve, reject) => {
      const req = http.request({
        host: 'localhost',
        port: 8080,
        path: '/process-gitlab',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 1000
      }, (res) => {
        resolve(res.statusCode || 0);
      });
      
      req.on('error', (err) => {
        reject(err);
      });
      
      req.write(JSON.stringify({
        PROCESSING_MODE: 'issue',
        GITLAB_URL: 'https://gitlab.com',
        GITLAB_TOKEN: 'test-token',
        ANTHROPIC_API_KEY: 'test-key'
      }));
      
      req.end();
    });
    
    const status = await testEndpoint();
    expect(status).toBe(200); // Expect success status
  });
});