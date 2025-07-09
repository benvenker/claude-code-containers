import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleGitLabNoteEvent } from './note';

describe('GitLab Note Handler', () => {
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

  describe('handleGitLabNoteEvent', () => {
    it('should exist and be a function', () => {
      expect(typeof handleGitLabNoteEvent).toBe('function');
    });

    it('should detect @duo-agent mentions in note text', async () => {
      const noteData = {
        object_kind: 'note',
        object_attributes: {
          id: 123,
          note: '@duo-agent Please help me understand this error',
          noteable_type: 'Issue',
          system: false,
          author_id: 456,
          noteable_id: 789,
          discussion_id: 'abc123'
        },
        user: { id: 456, username: 'developer', name: 'Developer Name', bot: false },
        project: { 
          id: 789, 
          name: 'my-project',
          path_with_namespace: 'group/my-project',
          git_http_url: 'https://gitlab.com/group/my-project.git'
        },
        issue: {
          id: 789,
          iid: 1,
          title: 'Fix login bug',
          description: 'Users cannot login...'
        }
      };

      const response = await handleGitLabNoteEvent(noteData, mockEnv, mockConfigDO);
      expect(response.status).toBe(200);
    });

    it('should ignore notes without @duo-agent mentions', async () => {
      const noteData = {
        object_kind: 'note',
        object_attributes: {
          id: 123,
          note: 'This is a regular comment without any mentions',
          noteable_type: 'Issue',
          system: false,
          author_id: 456,
          noteable_id: 789,
          discussion_id: 'abc123'
        },
        user: { id: 456, username: 'developer', name: 'Developer Name', bot: false },
        project: { 
          id: 789, 
          name: 'my-project',
          path_with_namespace: 'group/my-project'
        },
        issue: {
          id: 789,
          iid: 1,
          title: 'Fix login bug',
          description: 'Users cannot login...'
        }
      };

      const response = await handleGitLabNoteEvent(noteData, mockEnv, mockConfigDO);
      expect(response.status).toBe(200);
      
      // Should not invoke container for comments without @duo-agent
      expect(mockEnv.MY_CONTAINER.get).not.toHaveBeenCalled();
    });

    it('should filter out system notes', async () => {
      const noteData = {
        object_kind: 'note',
        object_attributes: {
          id: 123,
          note: '@duo-agent Please help me',
          noteable_type: 'Issue',
          system: true, // System note should be filtered out
          author_id: 456,
          noteable_id: 789,
          discussion_id: 'abc123'
        },
        user: { id: 456, username: 'developer', name: 'Developer Name', bot: false },
        project: { 
          id: 789, 
          name: 'my-project',
          path_with_namespace: 'group/my-project'
        },
        issue: {
          id: 789,
          iid: 1,
          title: 'Fix login bug',
          description: 'Users cannot login...'
        }
      };

      const response = await handleGitLabNoteEvent(noteData, mockEnv, mockConfigDO);
      expect(response.status).toBe(200);
      
      // Should not invoke container for system notes
      expect(mockEnv.MY_CONTAINER.get).not.toHaveBeenCalled();
    });

    it('should filter out bot comments', async () => {
      const noteData = {
        object_kind: 'note',
        object_attributes: {
          id: 123,
          note: '@duo-agent Please help me',
          noteable_type: 'Issue',
          system: false,
          author_id: 456,
          noteable_id: 789,
          discussion_id: 'abc123'
        },
        user: { id: 456, username: 'bot-user', name: 'Bot User', bot: true }, // Bot user should be filtered out
        project: { 
          id: 789, 
          name: 'my-project',
          path_with_namespace: 'group/my-project'
        },
        issue: {
          id: 789,
          iid: 1,
          title: 'Fix login bug',
          description: 'Users cannot login...'
        }
      };

      const response = await handleGitLabNoteEvent(noteData, mockEnv, mockConfigDO);
      expect(response.status).toBe(200);
      
      // Should not invoke container for bot comments
      expect(mockEnv.MY_CONTAINER.get).not.toHaveBeenCalled();
    });

    it('should ignore @duo-agent mentions inside code blocks', async () => {
      const noteData = {
        object_kind: 'note',
        object_attributes: {
          id: 123,
          note: 'Here is some code:\n```\n@duo-agent this should be ignored\n```\nBut this is not a mention.',
          noteable_type: 'Issue',
          system: false,
          author_id: 456,
          noteable_id: 789,
          discussion_id: 'abc123'
        },
        user: { id: 456, username: 'developer', name: 'Developer Name', bot: false },
        project: { 
          id: 789, 
          name: 'my-project',
          path_with_namespace: 'group/my-project'
        },
        issue: {
          id: 789,
          iid: 1,
          title: 'Fix login bug',
          description: 'Users cannot login...'
        }
      };

      const response = await handleGitLabNoteEvent(noteData, mockEnv, mockConfigDO);
      expect(response.status).toBe(200);
      
      // Should not invoke container for @duo-agent mentions inside code blocks
      expect(mockEnv.MY_CONTAINER.get).not.toHaveBeenCalled();
    });

    it('should handle issue comments with correct context', async () => {
      const noteData = {
        object_kind: 'note',
        object_attributes: {
          id: 123,
          note: '@duo-agent Please help me debug this authentication issue',
          noteable_type: 'Issue',
          system: false,
          author_id: 456,
          noteable_id: 789,
          discussion_id: 'abc123'
        },
        user: { id: 456, username: 'developer', name: 'Developer Name', bot: false },
        project: { 
          id: 789, 
          name: 'my-project',
          path_with_namespace: 'group/my-project',
          git_http_url: 'https://gitlab.com/group/my-project.git'
        },
        issue: {
          id: 789,
          iid: 1,
          title: 'Fix login bug',
          description: 'Users cannot login with OAuth'
        }
      };

      const mockContainer = {
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ success: true, message: 'Issue comment processed' }), { status: 200 })
        )
      };
      mockEnv.MY_CONTAINER.get.mockReturnValue(mockContainer);

      const response = await handleGitLabNoteEvent(noteData, mockEnv, mockConfigDO);
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
        PROCESSING_MODE: 'issue_comment',
        USER_PROMPT: 'Please help me debug this authentication issue',
        COMMENT_ID: '123',
        DISCUSSION_ID: 'abc123',
        COMMENT_AUTHOR: 'developer',
        ISSUE_IID: '1',
        ISSUE_TITLE: 'Fix login bug',
        ISSUE_DESCRIPTION: 'Users cannot login with OAuth'
      });
    });

    it('should handle MR comments with correct context', async () => {
      const noteData = {
        object_kind: 'note',
        object_attributes: {
          id: 456,
          note: '@duo-agent Can you review this function?',
          noteable_type: 'MergeRequest',
          system: false,
          author_id: 789,
          noteable_id: 101112,
          discussion_id: 'def456'
        },
        user: { id: 789, username: 'reviewer', name: 'Code Reviewer', bot: false },
        project: { 
          id: 789, 
          name: 'my-project',
          path_with_namespace: 'group/my-project',
          git_http_url: 'https://gitlab.com/group/my-project.git'
        },
        merge_request: {
          id: 101112,
          iid: 5,
          title: 'Add OAuth authentication',
          description: 'Implementing OAuth2 flow',
          source_branch: 'feature/oauth',
          target_branch: 'main'
        }
      };

      const mockContainer = {
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ success: true, message: 'MR comment processed' }), { status: 200 })
        )
      };
      mockEnv.MY_CONTAINER.get.mockReturnValue(mockContainer);

      const response = await handleGitLabNoteEvent(noteData, mockEnv, mockConfigDO);
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
        PROCESSING_MODE: 'mr_comment',
        USER_PROMPT: 'Can you review this function?',
        COMMENT_ID: '456',
        DISCUSSION_ID: 'def456',
        COMMENT_AUTHOR: 'reviewer',
        MR_IID: '5',
        MR_TITLE: 'Add OAuth authentication',
        MR_DESCRIPTION: 'Implementing OAuth2 flow',
        SOURCE_BRANCH: 'feature/oauth',
        TARGET_BRANCH: 'main'
      });
    });

    it('should handle container errors gracefully', async () => {
      const noteData = {
        object_kind: 'note',
        object_attributes: {
          id: 123,
          note: '@duo-agent Please help me',
          noteable_type: 'Issue',
          system: false,
          author_id: 456,
          noteable_id: 789,
          discussion_id: 'abc123'
        },
        user: { id: 456, username: 'developer', name: 'Developer Name', bot: false },
        project: { 
          id: 789, 
          name: 'my-project',
          path_with_namespace: 'group/my-project',
          git_http_url: 'https://gitlab.com/group/my-project.git'
        },
        issue: {
          id: 789,
          iid: 1,
          title: 'Fix login bug',
          description: 'Users cannot login...'
        }
      };

      const mockContainer = {
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ success: false, error: 'Container failed' }), { status: 500 })
        )
      };
      mockEnv.MY_CONTAINER.get.mockReturnValue(mockContainer);

      const response = await handleGitLabNoteEvent(noteData, mockEnv, mockConfigDO);
      expect(response.status).toBe(500);
    });

    it('should require Claude API key configuration', async () => {
      const noteData = {
        object_kind: 'note',
        object_attributes: {
          id: 123,
          note: '@duo-agent Please help me',
          noteable_type: 'Issue',
          system: false,
          author_id: 456,
          noteable_id: 789,
          discussion_id: 'abc123'
        },
        user: { id: 456, username: 'developer', name: 'Developer Name', bot: false },
        project: { 
          id: 789, 
          name: 'my-project',
          path_with_namespace: 'group/my-project',
          git_http_url: 'https://gitlab.com/group/my-project.git'
        },
        issue: {
          id: 789,
          iid: 1,
          title: 'Fix login bug',
          description: 'Users cannot login...'
        }
      };

      // Mock missing Claude API key
      mockEnv.GITLAB_APP_CONFIG.get.mockReturnValue({
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ anthropicApiKey: null }), { status: 200 })
        )
      });

      const response = await handleGitLabNoteEvent(noteData, mockEnv, mockConfigDO);
      expect(response.status).toBe(500);
    });

    it('should create unique container name for each note', async () => {
      const noteData = {
        object_kind: 'note',
        object_attributes: {
          id: 12345,
          note: '@duo-agent Please help me',
          noteable_type: 'Issue',
          system: false,
          author_id: 456,
          noteable_id: 789,
          discussion_id: 'abc123'
        },
        user: { id: 456, username: 'developer', name: 'Developer Name', bot: false },
        project: { 
          id: 789, 
          name: 'my-project',
          path_with_namespace: 'group/my-project',
          git_http_url: 'https://gitlab.com/group/my-project.git'
        },
        issue: {
          id: 789,
          iid: 1,
          title: 'Fix login bug',
          description: 'Users cannot login...'
        }
      };

      await handleGitLabNoteEvent(noteData, mockEnv, mockConfigDO);

      expect(mockEnv.MY_CONTAINER.idFromName).toHaveBeenCalledWith('claude-gitlab-note-12345');
    });
  });
});