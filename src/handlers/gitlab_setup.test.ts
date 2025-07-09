import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleGitLabSetup } from './gitlab_setup';

describe('GitLab Setup Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should exist and be a function', () => {
    expect(handleGitLabSetup).toBeDefined();
    expect(typeof handleGitLabSetup).toBe('function');
  });

  it('should serve setup form on GET /gitlab-setup', async () => {
    const mockRequest = new Request('http://test.com/gitlab-setup', {
      method: 'GET'
    });

    const mockEnv = {};

    const response = await handleGitLabSetup(mockRequest, 'http://test.com', mockEnv);
    
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    
    const html = await response.text();
    expect(html).toContain('GitLab Integration Setup');
    expect(html).toContain('Personal Access Token');
  });

  it('should handle POST /gitlab-setup/configure with valid data', async () => {
    const mockRequest = new Request('http://test.com/gitlab-setup/configure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gitlabUrl: 'https://gitlab.com',
        projectId: '123',
        token: 'glpat-test-token',
        webhookSecret: 'webhook-secret'
      })
    });

    // Mock GitLab API validation
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 
        id: 1, 
        username: 'testuser', 
        name: 'Test User' 
      })
    });

    const mockEnv = {
      GITLAB_APP_CONFIG: {
        idFromName: vi.fn().mockReturnValue('test-id'),
        get: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue(new Response('OK'))
        })
      }
    };

    const response = await handleGitLabSetup(mockRequest, 'http://test.com', mockEnv);
    
    expect(response.status).toBe(200);
    
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.webhookUrl).toContain('/webhooks/gitlab');
  });

  it('should return 400 for invalid GitLab token', async () => {
    const mockRequest = new Request('http://test.com/gitlab-setup/configure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gitlabUrl: 'https://gitlab.com',
        projectId: '123',
        token: 'invalid-token',
        webhookSecret: 'webhook-secret'
      })
    });

    // Mock GitLab API failure
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized'
    });

    const mockEnv = {};

    const response = await handleGitLabSetup(mockRequest, 'http://test.com', mockEnv);
    
    expect(response.status).toBe(400);
    
    const result = await response.json();
    expect(result.error).toContain('401');
  });

  it('should return 200 for GET /gitlab-setup/status', async () => {
    const mockRequest = new Request('http://test.com/gitlab-setup/status', {
      method: 'GET'
    });

    const mockEnv = {
      GITLAB_APP_CONFIG: {
        idFromName: vi.fn().mockReturnValue('test-id'),
        get: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ 
              configured: true, 
              projectId: '123' 
            }))
          )
        })
      }
    };

    const response = await handleGitLabSetup(mockRequest, 'http://test.com', mockEnv);
    
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
  });
});