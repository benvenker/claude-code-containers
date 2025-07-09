import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleGitLabWebhook } from './gitlab_webhook';

describe('GitLab Webhook Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should exist and be a function', () => {
    expect(handleGitLabWebhook).toBeDefined();
    expect(typeof handleGitLabWebhook).toBe('function');
  });

  it('should handle POST requests to GitLab webhook endpoint', async () => {
    const mockRequest = new Request('http://test.com/webhooks/gitlab', {
      method: 'POST',
      headers: {
        'X-Gitlab-Token': 'test-token',
        'X-Gitlab-Event': 'Issue Hook',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ object_kind: 'issue' })
    });

    const mockEnv = {
      GITLAB_APP_CONFIG: {
        idFromName: vi.fn().mockReturnValue('test-id'),
        get: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ webhookSecret: 'test-token' }))
          )
        })
      }
    };

    const response = await handleGitLabWebhook(mockRequest, mockEnv);
    
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBeLessThan(500); // Should not be a server error
  });

  it('should return 400 for missing required headers', async () => {
    const mockRequest = new Request('http://test.com/webhooks/gitlab', {
      method: 'POST',
      body: JSON.stringify({ object_kind: 'issue' })
    });

    const mockEnv = {};

    const response = await handleGitLabWebhook(mockRequest, mockEnv);
    
    expect(response.status).toBe(400);
  });

  it('should verify GitLab webhook signature with stored secret', async () => {
    const mockRequest = new Request('http://test.com/webhooks/gitlab', {
      method: 'POST',
      headers: {
        'X-Gitlab-Token': 'correct-secret',
        'X-Gitlab-Event': 'Issue Hook',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ object_kind: 'issue', project: { id: 123 } })
    });

    const mockEnv = {
      GITLAB_APP_CONFIG: {
        idFromName: vi.fn().mockReturnValue('test-id'),
        get: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ webhookSecret: 'correct-secret' }))
          )
        })
      }
    };

    const response = await handleGitLabWebhook(mockRequest, mockEnv);
    
    expect(response.status).toBe(200);
  });

  it('should return 401 for invalid webhook signature', async () => {
    const mockRequest = new Request('http://test.com/webhooks/gitlab', {
      method: 'POST',
      headers: {
        'X-Gitlab-Token': 'wrong-secret',
        'X-Gitlab-Event': 'Issue Hook',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ object_kind: 'issue', project: { id: 123 } })
    });

    const mockEnv = {
      GITLAB_APP_CONFIG: {
        idFromName: vi.fn().mockReturnValue('test-id'),
        get: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ webhookSecret: 'correct-secret' }))
          )
        })
      }
    };

    const response = await handleGitLabWebhook(mockRequest, mockEnv);
    
    expect(response.status).toBe(401);
  });

  it('should return 404 when no GitLab config is found', async () => {
    const mockRequest = new Request('http://test.com/webhooks/gitlab', {
      method: 'POST',
      headers: {
        'X-Gitlab-Token': 'any-token',
        'X-Gitlab-Event': 'Issue Hook',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ object_kind: 'issue', project: { id: 123 } })
    });

    const mockEnv = {
      GITLAB_APP_CONFIG: {
        idFromName: vi.fn().mockReturnValue('test-id'),
        get: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue(
            new Response('Not found', { status: 404 })
          )
        })
      }
    };

    const response = await handleGitLabWebhook(mockRequest, mockEnv);
    
    expect(response.status).toBe(404);
  });

  describe('Event Routing', () => {
    const createMockEnv = () => ({
      MY_CONTAINER: {
        idFromName: vi.fn().mockReturnValue('mock-container-id'),
        get: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ success: true, message: 'Issue processed' }), { status: 200 })
          )
        })
      },
      GITLAB_APP_CONFIG: {
        idFromName: vi.fn((name) => `test-id-${name}`),
        get: vi.fn((id) => {
          if (id === 'test-id-123') {
            // Configuration lookup
            return {
              fetch: vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ 
                  webhookSecret: 'test-token',
                  token: 'test-gitlab-token',
                  url: 'https://gitlab.com',
                  projectId: '123'
                }))
              )
            };
          } else if (id === 'test-id-claude-config') {
            // Claude API key lookup
            return {
              fetch: vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ anthropicApiKey: 'test-claude-key' }))
              )
            };
          }
          return {
            fetch: vi.fn().mockResolvedValue(new Response('Not found', { status: 404 }))
          };
        })
      }
    });

    it('should route issue events to issue handler', async () => {
      const mockRequest = new Request('http://test.com/webhooks/gitlab', {
        method: 'POST',
        headers: {
          'X-Gitlab-Token': 'test-token',
          'X-Gitlab-Event': 'Issue Hook',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          object_kind: 'issue',
          object_attributes: { 
            action: 'open',
            id: 123,
            iid: 1,
            title: 'Test Issue',
            description: 'Test description'
          },
          user: { id: 456, username: 'testuser', name: 'Test User' },
          project: { 
            id: 123,
            name: 'test-project',
            path_with_namespace: 'group/test-project',
            git_http_url: 'https://gitlab.com/group/test-project.git'
          }
        })
      });

      const response = await handleGitLabWebhook(mockRequest, createMockEnv());
      
      expect(response.status).toBe(200);
      const responseText = await response.text();
      expect(responseText).toContain('issue');
    });

    it('should route note events to note handler', async () => {
      const mockRequest = new Request('http://test.com/webhooks/gitlab', {
        method: 'POST',
        headers: {
          'X-Gitlab-Token': 'test-token',
          'X-Gitlab-Event': 'Note Hook',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          object_kind: 'note',
          object_attributes: { noteable_type: 'Issue', note: '@duo-agent help me' },
          project: { id: 123 }
        })
      });

      const response = await handleGitLabWebhook(mockRequest, createMockEnv());
      
      expect(response.status).toBe(200);
      const responseText = await response.text();
      expect(responseText).toContain('note');
    });

    it('should route merge request events to MR handler', async () => {
      const mockRequest = new Request('http://test.com/webhooks/gitlab', {
        method: 'POST',
        headers: {
          'X-Gitlab-Token': 'test-token',
          'X-Gitlab-Event': 'Merge Request Hook',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          object_kind: 'merge_request',
          object_attributes: { action: 'open' },
          project: { id: 123 }
        })
      });

      const response = await handleGitLabWebhook(mockRequest, createMockEnv());
      
      expect(response.status).toBe(200);
      const responseText = await response.text();
      expect(responseText).toContain('merge_request');
    });

    it('should return 200 for unsupported event types', async () => {
      const mockRequest = new Request('http://test.com/webhooks/gitlab', {
        method: 'POST',
        headers: {
          'X-Gitlab-Token': 'test-token',
          'X-Gitlab-Event': 'Push Hook',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          object_kind: 'push',
          project: { id: 123 }
        })
      });

      const response = await handleGitLabWebhook(mockRequest, createMockEnv());
      
      expect(response.status).toBe(200);
      const responseText = await response.text();
      expect(responseText).toContain('not supported');
    });
  });
});