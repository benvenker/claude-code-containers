/**
 * TDD Test: Fix for Cloudflare container networking
 * This test will FAIL until we fix the server listening configuration
 */

import { promises as fs } from 'fs';
import * as path from 'path';

describe('Cloudflare Container Networking Fix', () => {
  it('PORT should use environment variable if available', async () => {
    const mainPath = path.join(__dirname, '..', 'src', 'main.ts');
    const content = await fs.readFile(mainPath, 'utf-8');
    
    // This test expects PORT to use process.env.PORT with fallback to 8080
    // Currently it's hardcoded to 8080
    const portLine = content.match(/const PORT = (.+);/);
    expect(portLine).toBeTruthy();
    
    // FAILING TEST: We expect this pattern
    expect(portLine![1]).toMatch(/process\.env\.PORT \|\| 8080/);
  });

  it('server should listen without specifying host for Cloudflare compatibility', async () => {
    const mainPath = path.join(__dirname, '..', 'src', 'main.ts');
    const content = await fs.readFile(mainPath, 'utf-8');
    
    // Find server.listen call
    const listenMatch = content.match(/server\.listen\([^)]+\)/);
    expect(listenMatch).toBeTruthy();
    
    const listenCall = listenMatch![0];
    
    // FAILING TEST: server.listen should NOT specify a host
    // Currently: server.listen(PORT, '0.0.0.0', callback)
    // Should be: server.listen(PORT, callback)
    expect(listenCall).not.toContain("'0.0.0.0'");
    expect(listenCall).toMatch(/server\.listen\(PORT,\s*\(/);
  });

  it('should log the actual listening address after server starts', async () => {
    const mainPath = path.join(__dirname, '..', 'src', 'main.ts');
    const content = await fs.readFile(mainPath, 'utf-8');
    
    // Check if we're logging the server address properly
    const serverListenBlock = content.match(/server\.listen\([^}]+\}/s);
    expect(serverListenBlock).toBeTruthy();
    
    // We should be getting the actual address from server.address()
    expect(serverListenBlock![0]).toContain('server.address()');
  });
});