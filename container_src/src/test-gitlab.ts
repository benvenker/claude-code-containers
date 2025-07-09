// Quick test script to verify GitLab processing works
import { detectProcessingMode, validateGitLabContext } from './main.js';

// Simulate GitLab environment
process.env.GITLAB_URL = 'https://gitlab.com';
process.env.GITLAB_TOKEN = 'test-token';
process.env.GITLAB_PROJECT_ID = '123';
process.env.PROCESSING_MODE = 'issue';
process.env.ISSUE_IID = '1';
process.env.ISSUE_TITLE = 'Test Issue';
process.env.ISSUE_DESCRIPTION = 'Test Description';
process.env.PROJECT_NAMESPACE = 'test/project';
process.env.GIT_CLONE_URL = 'https://gitlab.com/test/project.git';
process.env.AUTHOR_USERNAME = 'testuser';

console.log('Testing GitLab processing detection...');
console.log('Processing mode:', detectProcessingMode());
console.log('GitLab context valid:', validateGitLabContext());

// Test if we can import the functions without starting the server
console.log('\nTrying to import functions...');
try {
  // Import specific functions instead of the whole module to avoid server startup
  const mainModule = await import('./main.js');
  console.log('Main module loaded successfully');
  console.log('Available exports:', Object.keys(mainModule));
  
  // Try importing required modules
  console.log('\nTesting module imports...');
  try {
    await import('@anthropic-ai/claude-code');
    console.log('✓ Claude Code SDK imported successfully');
  } catch (e: any) {
    console.error('✗ Claude Code SDK import failed:', e.message);
  }
  
  try {
    await import('./gitlab_client.js');
    console.log('✓ GitLab client imported successfully');
  } catch (e: any) {
    console.error('✗ GitLab client import failed:', e.message);
  }
  
} catch (error: any) {
  console.error('Error loading module:', error.message);
  console.error(error.stack);
}