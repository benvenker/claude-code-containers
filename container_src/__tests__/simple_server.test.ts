/**
 * Simple test to verify main.ts creates an HTTP server
 * TDD: This test should FAIL first, then we make it pass
 */

import { jest } from '@jest/globals';

describe('Container Server Creation', () => {
  it('main.ts should export a server that listens on port 8080', async () => {
    // Try to import main.ts
    // This will fail because main.ts doesn't export anything
    const main = await import('../src/main') as any;
    
    // These assertions will fail because main.ts doesn't export these
    expect(main.server).toBeDefined();
    expect(main.PORT).toBeDefined();
    expect(main.PORT).toBe(8080);
  });

  it('main.ts should create HTTP server at the end of the file', async () => {
    // Read the main.ts file content
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const mainPath = path.join(__dirname, '..', 'src', 'main.ts');
    const content = await fs.readFile(mainPath, 'utf-8');
    
    // Check if it contains server creation code
    expect(content).toContain('http.createServer');
    expect(content).toContain('server.listen(PORT');
    expect(content).toContain('export { server, PORT }');
  });
});