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
});