/**
 * Test container startup to identify issues
 */

import { spawn } from 'child_process';
import * as path from 'path';

describe('Container Startup', () => {
  it('should start without errors', (done) => {
    const mainPath = path.join(__dirname, '..', 'dist', 'main.js');
    
    const serverProcess = spawn('node', [mainPath], {
      env: {
        ...process.env,
        PORT: '8080'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let hasError = false;

    serverProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log('STDOUT:', data.toString());
    });

    serverProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error('STDERR:', data.toString());
      hasError = true;
    });

    serverProcess.on('error', (error) => {
      console.error('Process error:', error);
      hasError = true;
      done(error);
    });

    // Give it 3 seconds to start
    setTimeout(() => {
      if (!hasError && stdout.includes('Claude Code container server started')) {
        serverProcess.kill();
        done();
      } else {
        serverProcess.kill();
        done(new Error(`Server failed to start properly. STDOUT: ${stdout}, STDERR: ${stderr}`));
      }
    }, 3000);
  }, 10000);

  it('should handle missing imports gracefully', async () => {
    // Test that all imports resolve correctly
    try {
      await import('../dist/main.js');
      await import('../dist/github_client.js');
      await import('../dist/gitlab_client.js');
    } catch (error: any) {
      throw new Error(`Import failed: ${error.message}`);
    }
  });
});