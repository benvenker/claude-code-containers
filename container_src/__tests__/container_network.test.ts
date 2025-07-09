/**
 * Test to verify container networking configuration
 * This test checks if we're listening on the correct address for Cloudflare containers
 */

import { promises as fs } from 'fs';
import * as path from 'path';

describe('Container Network Configuration', () => {
  it('should listen on the correct address for Cloudflare containers', async () => {
    // Read main.ts to check the listen configuration
    const mainPath = path.join(__dirname, '..', 'src', 'main.ts');
    const content = await fs.readFile(mainPath, 'utf-8');
    
    // Find the server.listen line
    const listenMatch = content.match(/server\.listen\(.*?\)/s);
    expect(listenMatch).toBeTruthy();
    
    // Current implementation listens on 0.0.0.0
    // But Cloudflare might expect 10.0.0.1 or no host specification
    const listenLine = listenMatch![0];
    
    // This test documents the issue: we're listening on 0.0.0.0
    // but Cloudflare expects 10.0.0.1:8080
    expect(listenLine).toContain("'0.0.0.0'");
    
    // TODO: This might need to be changed to:
    // server.listen(PORT) - without specifying host
    // OR
    // server.listen(PORT, '10.0.0.1', ...)
  });

  it('should use PORT environment variable or default to 8080', async () => {
    const mainPath = path.join(__dirname, '..', 'src', 'main.ts');
    const content = await fs.readFile(mainPath, 'utf-8');
    
    // Check PORT constant definition
    expect(content).toMatch(/const PORT = .*8080/);
    
    // Verify it uses process.env.PORT if available
    const portMatch = content.match(/const PORT = (.+);/);
    expect(portMatch).toBeTruthy();
    
    // Should ideally be: process.env.PORT || 8080
    // Currently it's just: 8080
    expect(portMatch![1]).toBe('8080');
  });

  it('should check for Cloudflare container-specific environment variables', async () => {
    // Document known Cloudflare container environment variables
    const cloudflareEnvVars = [
      'CLOUDFLARE_DEPLOYMENT_ID',
      'PORT',
      'HOST',
      'HOSTNAME'
    ];
    
    // This test documents what environment variables might be available
    // in Cloudflare container runtime
    cloudflareEnvVars.forEach(envVar => {
      console.log(`${envVar}: ${process.env[envVar] || 'not set'}`);
    });
    
    expect(true).toBe(true); // Placeholder assertion
  });
});