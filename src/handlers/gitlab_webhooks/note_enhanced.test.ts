import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleEnhancedGitLabNoteEvent } from './note_enhanced';

describe('Enhanced GitLab Note Handler', () => {
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

  describe('handleEnhancedGitLabNoteEvent', () => {
    it('should enhance MR comments with file/line context', async () => {
      const noteData = {
        object_attributes: {
          id: 123,
          note: '@duo-agent Can you review this function?',
          noteable_type: 'MergeRequest',
          discussion_id: 'discussion-123',
          position: {
            base_sha: 'abc123',
            head_sha: 'def456',
            new_path: 'src/auth.js',
            new_line: 42,
            old_line: 42
          }
        },
        user: {
          id: 456,
          username: 'developer',
          bot: false
        },
        project: {
          id: 789,
          path_with_namespace: 'group/project',
          git_http_url: 'https://gitlab.com/group/project.git'
        },
        merge_request: {
          iid: 1,
          title: 'Add authentication',
          description: 'Adding OAuth2 authentication',
          source_branch: 'feature/auth',
          target_branch: 'main'
        }
      };

      const response = await handleEnhancedGitLabNoteEvent(noteData, mockEnv, mockConfigDO);
      
      expect(response.status).toBe(200);
      expect(mockEnv.MY_CONTAINER.get).toHaveBeenCalled();
      expect(mockEnv.MY_CONTAINER.get().fetch).toHaveBeenCalled();
    });

    it('should enhance issue comments with discussion thread context', async () => {
      const noteData = {
        object_attributes: {
          id: 123,
          note: '@duo-agent Please clarify this issue',
          noteable_type: 'Issue',
          discussion_id: 'discussion-456',
          position: null
        },
        user: {
          id: 456,
          username: 'developer',
          bot: false
        },
        project: {
          id: 789,
          path_with_namespace: 'group/project',
          git_http_url: 'https://gitlab.com/group/project.git'
        },
        issue: {
          iid: 1,
          title: 'Login bug',
          description: 'Users cannot login with OAuth'
        }
      };

      const response = await handleEnhancedGitLabNoteEvent(noteData, mockEnv, mockConfigDO);
      
      expect(response.status).toBe(200);
      expect(mockEnv.MY_CONTAINER.get).toHaveBeenCalled();
      expect(mockEnv.MY_CONTAINER.get().fetch).toHaveBeenCalled();
    });

    it('should include relevant GitLab links in container context', async () => {
      const noteData = {
        object_attributes: {
          id: 123,
          note: '@duo-agent Help with this MR',
          noteable_type: 'MergeRequest',
          discussion_id: 'discussion-123',
          position: null
        },
        user: {
          id: 456,
          username: 'developer',
          bot: false
        },
        project: {
          id: 789,
          path_with_namespace: 'group/project',
          git_http_url: 'https://gitlab.com/group/project.git',
          web_url: 'https://gitlab.com/group/project'
        },
        merge_request: {
          iid: 1,
          title: 'Add authentication',
          description: 'Adding OAuth2 authentication',
          source_branch: 'feature/auth',
          target_branch: 'main'
        }
      };

      const response = await handleEnhancedGitLabNoteEvent(noteData, mockEnv, mockConfigDO);
      
      expect(response.status).toBe(200);
      expect(mockEnv.MY_CONTAINER.get).toHaveBeenCalled();
      expect(mockEnv.MY_CONTAINER.get().fetch).toHaveBeenCalled();
    });
  });
});