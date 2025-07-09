import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleGitLabIssuesEvent } from './issue';

describe('GitLab Issues Handler', () => {
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

  describe('handleGitLabIssuesEvent', () => {
    it('should exist and be a function', () => {
      expect(typeof handleGitLabIssuesEvent).toBe('function');
    });

    it('should only process "open" action events', async () => {
      const issueData = {
        action: 'closed',
        object_attributes: {
          action: 'close',
          id: 123,
          iid: 1,
          title: 'Test Issue',
          description: 'Test description'
        },
        user: { id: 456, username: 'testuser', name: 'Test User' },
        project: { 
          id: 789, 
          name: 'test-project',
          path_with_namespace: 'group/test-project',
          git_http_url: 'https://gitlab.com/group/test-project.git'
        }
      };

      const response = await handleGitLabIssuesEvent(issueData, mockEnv, mockConfigDO);
      expect(response.status).toBe(200);
      
      // Should not invoke container for non-open actions
      expect(mockEnv.MY_CONTAINER.get).not.toHaveBeenCalled();
    });

    it('should extract correct context for container when processing open issues', async () => {
      const issueData = {
        action: 'open',
        object_attributes: {
          action: 'open',
          id: 123,
          iid: 1,
          title: 'Fix login bug',
          description: 'Users cannot login with OAuth',
          author_id: 456,
          project_id: 789,
          labels: [{ name: 'bug' }, { name: 'priority-high' }]
        },
        user: { id: 456, username: 'developer', name: 'Developer Name' },
        project: { 
          id: 789, 
          name: 'my-project',
          path_with_namespace: 'group/my-project',
          git_http_url: 'https://gitlab.com/group/my-project.git'
        }
      };

      const mockContainer = {
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ success: true, message: 'Issue processed' }), { status: 200 })
        )
      };
      mockEnv.MY_CONTAINER.get.mockReturnValue(mockContainer);

      const response = await handleGitLabIssuesEvent(issueData, mockEnv, mockConfigDO);
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
        PROCESSING_MODE: 'issue',
        GITLAB_URL: 'https://gitlab.com',
        GITLAB_TOKEN: 'test-gitlab-token',
        GITLAB_PROJECT_ID: '123',
        ISSUE_IID: '1',
        ISSUE_TITLE: 'Fix login bug',
        ISSUE_DESCRIPTION: 'Users cannot login with OAuth',
        PROJECT_NAMESPACE: 'group/my-project',
        GIT_CLONE_URL: 'https://gitlab.com/group/my-project.git',
        ISSUE_AUTHOR: 'developer'
      });
    });

    it('should handle container errors gracefully', async () => {
      const issueData = {
        action: 'open',
        object_attributes: {
          action: 'open',
          id: 123,
          iid: 1,
          title: 'Test Issue',
          description: 'Test description'
        },
        user: { id: 456, username: 'testuser', name: 'Test User' },
        project: { 
          id: 789, 
          name: 'test-project',
          path_with_namespace: 'group/test-project',
          git_http_url: 'https://gitlab.com/group/test-project.git'
        }
      };

      const mockContainer = {
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ success: false, error: 'Container failed' }), { status: 500 })
        )
      };
      mockEnv.MY_CONTAINER.get.mockReturnValue(mockContainer);

      const response = await handleGitLabIssuesEvent(issueData, mockEnv, mockConfigDO);
      expect(response.status).toBe(500);
    });

    it('should require Claude API key configuration', async () => {
      const issueData = {
        action: 'open',
        object_attributes: {
          action: 'open',
          id: 123,
          iid: 1,
          title: 'Test Issue',
          description: 'Test description'
        },
        user: { id: 456, username: 'testuser', name: 'Test User' },
        project: { 
          id: 789, 
          name: 'test-project',
          path_with_namespace: 'group/test-project',
          git_http_url: 'https://gitlab.com/group/test-project.git'
        }
      };

      // Mock missing Claude API key
      mockEnv.GITLAB_APP_CONFIG.get.mockReturnValue({
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ anthropicApiKey: null }), { status: 200 })
        )
      });

      const response = await handleGitLabIssuesEvent(issueData, mockEnv, mockConfigDO);
      expect(response.status).toBe(500);
    });

    it('should create unique container name for each issue', async () => {
      const issueData = {
        action: 'open',
        object_attributes: {
          action: 'open',
          id: 12345,
          iid: 1,
          title: 'Test Issue',
          description: 'Test description'
        },
        user: { id: 456, username: 'testuser', name: 'Test User' },
        project: { 
          id: 789, 
          name: 'test-project',
          path_with_namespace: 'group/test-project',
          git_http_url: 'https://gitlab.com/group/test-project.git'
        }
      };

      await handleGitLabIssuesEvent(issueData, mockEnv, mockConfigDO);

      expect(mockEnv.MY_CONTAINER.idFromName).toHaveBeenCalledWith('claude-gitlab-issue-12345');
    });
  });
});