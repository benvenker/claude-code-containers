import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleGitLabMergeRequestEvent } from './merge_request';

describe('GitLab Merge Request Handler', () => {
  let mockEnv: any;
  let mockConfigDO: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock container environment
    mockEnv = {
      MY_CONTAINER: {
        idFromName: vi.fn().mockReturnValue('mock-container-id'),
        get: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ success: true, message: 'Container processed successfully' }), { status: 200 })
          )
        })
      },
      GITLAB_APP_CONFIG: {
        idFromName: vi.fn().mockReturnValue('mock-config-id'),
        get: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ anthropicApiKey: 'test-claude-key' }), { status: 200 })
          )
        })
      }
    };

    // Mock GitLab config DO
    mockConfigDO = {
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ 
          token: 'test-gitlab-token',
          url: 'https://gitlab.com',
          projectId: '123'
        }), { status: 200 })
      )
    };
  });

  describe('handleGitLabMergeRequestEvent', () => {
    it('should exist and be a function', () => {
      expect(typeof handleGitLabMergeRequestEvent).toBe('function');
    });

    it('should detect @duo-agent mentions in MR description', async () => {
      const mrData = {
        object_kind: 'merge_request',
        object_attributes: {
          id: 123,
          iid: 5,
          title: 'Add OAuth authentication',
          description: '@duo-agent Please implement OAuth2 authentication with proper error handling',
          action: 'open',
          source_branch: 'feature/oauth',
          target_branch: 'main',
          author_id: 456,
          created_at: '2025-01-01T00:00:00Z',
          state: 'opened'
        },
        user: { id: 456, username: 'developer', name: 'Developer Name', bot: false },
        project: { 
          id: 789, 
          name: 'my-project',
          path_with_namespace: 'group/my-project',
          git_http_url: 'https://gitlab.com/group/my-project.git'
        }
      };

      const response = await handleGitLabMergeRequestEvent(mrData, mockEnv, mockConfigDO);
      expect(response.status).toBe(200);
    });

    it('should ignore MRs without @duo-agent mentions', async () => {
      const mrData = {
        object_kind: 'merge_request',
        object_attributes: {
          id: 123,
          iid: 5,
          title: 'Add OAuth authentication',
          description: 'This MR implements OAuth2 authentication without any special instructions',
          action: 'open',
          source_branch: 'feature/oauth',
          target_branch: 'main',
          author_id: 456,
          created_at: '2025-01-01T00:00:00Z',
          state: 'opened'
        },
        user: { id: 456, username: 'developer', name: 'Developer Name', bot: false },
        project: { 
          id: 789, 
          name: 'my-project',
          path_with_namespace: 'group/my-project',
          git_http_url: 'https://gitlab.com/group/my-project.git'
        }
      };

      const response = await handleGitLabMergeRequestEvent(mrData, mockEnv, mockConfigDO);
      expect(response.status).toBe(200);
      
      // Should not invoke container for MRs without @duo-agent
      expect(mockEnv.MY_CONTAINER.get).not.toHaveBeenCalled();
    });

    it('should only process "open" action events', async () => {
      const mrData = {
        object_kind: 'merge_request',
        object_attributes: {
          id: 123,
          iid: 5,
          title: 'Add OAuth authentication',
          description: '@duo-agent Please implement OAuth2 authentication',
          action: 'close', // Should be ignored
          source_branch: 'feature/oauth',
          target_branch: 'main',
          author_id: 456,
          created_at: '2025-01-01T00:00:00Z',
          state: 'closed'
        },
        user: { id: 456, username: 'developer', name: 'Developer Name', bot: false },
        project: { 
          id: 789, 
          name: 'my-project',
          path_with_namespace: 'group/my-project',
          git_http_url: 'https://gitlab.com/group/my-project.git'
        }
      };

      const response = await handleGitLabMergeRequestEvent(mrData, mockEnv, mockConfigDO);
      expect(response.status).toBe(200);
      
      // Should not invoke container for non-"open" actions
      expect(mockEnv.MY_CONTAINER.get).not.toHaveBeenCalled();
    });

    it('should filter out bot-created MRs', async () => {
      const mrData = {
        object_kind: 'merge_request',
        object_attributes: {
          id: 123,
          iid: 5,
          title: 'Add OAuth authentication',
          description: '@duo-agent Please implement OAuth2 authentication',
          action: 'open',
          source_branch: 'feature/oauth',
          target_branch: 'main',
          author_id: 456,
          created_at: '2025-01-01T00:00:00Z',
          state: 'opened'
        },
        user: { id: 456, username: 'bot-user', name: 'Bot User', bot: true }, // Bot user should be filtered out
        project: { 
          id: 789, 
          name: 'my-project',
          path_with_namespace: 'group/my-project',
          git_http_url: 'https://gitlab.com/group/my-project.git'
        }
      };

      const response = await handleGitLabMergeRequestEvent(mrData, mockEnv, mockConfigDO);
      expect(response.status).toBe(200);
      
      // Should not invoke container for bot-created MRs
      expect(mockEnv.MY_CONTAINER.get).not.toHaveBeenCalled();
    });

    it('should ignore @duo-agent mentions inside code blocks', async () => {
      const mrData = {
        object_kind: 'merge_request',
        object_attributes: {
          id: 123,
          iid: 5,
          title: 'Add OAuth authentication',
          description: 'This MR implements OAuth2:\n```\n@duo-agent this should be ignored\n```\nNo real instructions here.',
          action: 'open',
          source_branch: 'feature/oauth',
          target_branch: 'main',
          author_id: 456,
          created_at: '2025-01-01T00:00:00Z',
          state: 'opened'
        },
        user: { id: 456, username: 'developer', name: 'Developer Name', bot: false },
        project: { 
          id: 789, 
          name: 'my-project',
          path_with_namespace: 'group/my-project',
          git_http_url: 'https://gitlab.com/group/my-project.git'
        }
      };

      const response = await handleGitLabMergeRequestEvent(mrData, mockEnv, mockConfigDO);
      expect(response.status).toBe(200);
      
      // Should not invoke container for @duo-agent mentions inside code blocks
      expect(mockEnv.MY_CONTAINER.get).not.toHaveBeenCalled();
    });

    it('should handle MR with @duo-agent instructions correctly', async () => {
      const mrData = {
        object_kind: 'merge_request',
        object_attributes: {
          id: 123,
          iid: 5,
          title: 'Add OAuth authentication',
          description: '@duo-agent Please implement OAuth2 authentication with proper error handling and unit tests',
          action: 'open',
          source_branch: 'feature/oauth',
          target_branch: 'main',
          author_id: 456,
          created_at: '2025-01-01T00:00:00Z',
          state: 'opened'
        },
        user: { id: 456, username: 'developer', name: 'Developer Name', bot: false },
        project: { 
          id: 789, 
          name: 'my-project',
          path_with_namespace: 'group/my-project',
          git_http_url: 'https://gitlab.com/group/my-project.git'
        }
      };

      const mockContainer = {
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ success: true, message: 'MR processed' }), { status: 200 })
        )
      };
      mockEnv.MY_CONTAINER.get.mockReturnValue(mockContainer);

      const response = await handleGitLabMergeRequestEvent(mrData, mockEnv, mockConfigDO);
      expect(response.status).toBe(200);

      // Verify container was invoked
      expect(mockContainer.fetch).toHaveBeenCalledTimes(1);
      
      const fetchCall = mockContainer.fetch.mock.calls[0];
      const request = fetchCall[0];
      expect(request.method).toBe('POST');
      expect(request.url).toBe('http://internal/process-gitlab');
      
      // Read and parse the request body
      const requestBodyText = await request.text();
      const requestBody = JSON.parse(requestBodyText);
      
      expect(requestBody).toMatchObject({
        PROCESSING_MODE: 'mr_creation',
        USER_PROMPT: 'Please implement OAuth2 authentication with proper error handling and unit tests',
        MR_IID: '5',
        MR_TITLE: 'Add OAuth authentication',
        MR_DESCRIPTION: '@duo-agent Please implement OAuth2 authentication with proper error handling and unit tests',
        SOURCE_BRANCH: 'feature/oauth',
        TARGET_BRANCH: 'main',
        MR_AUTHOR: 'developer'
      });
    });

    it('should handle container errors gracefully', async () => {
      const mrData = {
        object_kind: 'merge_request',
        object_attributes: {
          id: 123,
          iid: 5,
          title: 'Add OAuth authentication',
          description: '@duo-agent Please implement OAuth2 authentication',
          action: 'open',
          source_branch: 'feature/oauth',
          target_branch: 'main',
          author_id: 456,
          created_at: '2025-01-01T00:00:00Z',
          state: 'opened'
        },
        user: { id: 456, username: 'developer', name: 'Developer Name', bot: false },
        project: { 
          id: 789, 
          name: 'my-project',
          path_with_namespace: 'group/my-project',
          git_http_url: 'https://gitlab.com/group/my-project.git'
        }
      };

      const mockContainer = {
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ success: false, error: 'Container failed' }), { status: 500 })
        )
      };
      mockEnv.MY_CONTAINER.get.mockReturnValue(mockContainer);

      const response = await handleGitLabMergeRequestEvent(mrData, mockEnv, mockConfigDO);
      expect(response.status).toBe(500);
    });

    it('should require Claude API key configuration', async () => {
      const mrData = {
        object_kind: 'merge_request',
        object_attributes: {
          id: 123,
          iid: 5,
          title: 'Add OAuth authentication',
          description: '@duo-agent Please implement OAuth2 authentication',
          action: 'open',
          source_branch: 'feature/oauth',
          target_branch: 'main',
          author_id: 456,
          created_at: '2025-01-01T00:00:00Z',
          state: 'opened'
        },
        user: { id: 456, username: 'developer', name: 'Developer Name', bot: false },
        project: { 
          id: 789, 
          name: 'my-project',
          path_with_namespace: 'group/my-project',
          git_http_url: 'https://gitlab.com/group/my-project.git'
        }
      };

      // Mock missing Claude API key
      mockEnv.GITLAB_APP_CONFIG.get.mockReturnValue({
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ anthropicApiKey: null }), { status: 200 })
        )
      });

      const response = await handleGitLabMergeRequestEvent(mrData, mockEnv, mockConfigDO);
      expect(response.status).toBe(500);
    });

    it('should create unique container name for each MR', async () => {
      const mrData = {
        object_kind: 'merge_request',
        object_attributes: {
          id: 12345,
          iid: 5,
          title: 'Add OAuth authentication',
          description: '@duo-agent Please implement OAuth2 authentication',
          action: 'open',
          source_branch: 'feature/oauth',
          target_branch: 'main',
          author_id: 456,
          created_at: '2025-01-01T00:00:00Z',
          state: 'opened'
        },
        user: { id: 456, username: 'developer', name: 'Developer Name', bot: false },
        project: { 
          id: 789, 
          name: 'my-project',
          path_with_namespace: 'group/my-project',
          git_http_url: 'https://gitlab.com/group/my-project.git'
        }
      };

      await handleGitLabMergeRequestEvent(mrData, mockEnv, mockConfigDO);

      expect(mockEnv.MY_CONTAINER.idFromName).toHaveBeenCalledWith('claude-gitlab-mr-12345');
    });
  });
});