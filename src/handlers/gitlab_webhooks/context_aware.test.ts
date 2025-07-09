import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  extractFileLineContext, 
  extractDiscussionThreadContext, 
  formatContextAwareResponse,
  enhanceMRCommentContext 
} from './context_aware';

describe('Context-Aware Processing', () => {
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

  describe('extractFileLineContext', () => {
    it('should extract file/line information from MR comment position', async () => {
      const positionData = {
        base_sha: 'abc123',
        head_sha: 'def456',
        start_sha: 'abc123',
        new_path: 'src/auth.js',
        old_path: 'src/auth.js',
        new_line: 42,
        old_line: 42
      };

      const mockCredentials = {
        token: 'test-token',
        url: 'https://gitlab.com',
        projectId: '123'
      };
      const result = await extractFileLineContext(positionData, mockCredentials);
      
      expect(result).toEqual({
        filePath: 'src/auth.js',
        lineNumber: 42,
        baseSha: 'abc123',
        headSha: 'def456',
        codeContext: expect.any(String)
      });
    });

    it('should return null when no position data available', async () => {
      const result = await extractFileLineContext(null, null);
      expect(result).toBeNull();
    });
  });

  describe('extractDiscussionThreadContext', () => {
    it('should fetch discussion thread context from GitLab API', async () => {
      const mockCredentials = {
        token: 'test-token',
        url: 'https://gitlab.com',
        projectId: '123'
      };
      const result = await extractDiscussionThreadContext(
        'discussion-123',
        1,
        'MergeRequest',
        mockCredentials
      );
      
      expect(result).toEqual({
        discussionId: 'discussion-123',
        threadComments: expect.any(Array),
        totalComments: expect.any(Number)
      });
    });

    it('should handle missing discussion ID', async () => {
      const result = await extractDiscussionThreadContext(
        null,
        1,
        'MergeRequest',
        null
      );
      
      expect(result).toBeNull();
    });
  });

  describe('formatContextAwareResponse', () => {
    it('should format response with file/line context for MR comments', () => {
      const context = {
        triggerType: 'mr_comment',
        fileContext: {
          filePath: 'src/auth.js',
          lineNumber: 42,
          codeContext: 'function authenticate() { /* ... */ }'
        },
        userPrompt: 'Can you review this function?',
        response: 'This function looks good but could use better error handling.'
      };

      const result = formatContextAwareResponse(context);
      
      expect(result).toContain('## 🔍 Code Review: `src/auth.js` (Line 42)');
      expect(result).toContain('```javascript');
      expect(result).toContain('function authenticate()');
      expect(result).toContain('This function looks good but could use better error handling.');
      expect(result).toContain('📋 Commit Information');
      expect(result).toContain('context-aware processing');
    });

    it('should format response with discussion context for threaded comments', () => {
      const context = {
        triggerType: 'issue_comment',
        threadContext: {
          discussionId: 'discussion-123',
          threadComments: [
            { author: 'user1', body: 'Initial comment' },
            { author: 'user2', body: 'Follow-up question' }
          ],
          totalComments: 2
        },
        userPrompt: 'Can you clarify this?',
        response: 'Based on the discussion above, here is the clarification...'
      };

      const result = formatContextAwareResponse(context);
      
      expect(result).toContain('## 💬 Discussion Context (2 comments)');
      expect(result).toContain('**@user1:** Initial comment');
      expect(result).toContain('**@user2:** Follow-up question');
      expect(result).toContain('Based on the discussion above');
      expect(result).toContain('context-aware processing');
    });
  });

  describe('enhanceMRCommentContext', () => {
    it('should enhance MR comment context with file/line and discussion data', async () => {
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
        merge_request: {
          iid: 1,
          title: 'Add authentication',
          description: 'Adding OAuth2 authentication'
        }
      };

      const mockCredentials = {
        token: 'test-token',
        url: 'https://gitlab.com',
        projectId: '123'
      };
      const result = await enhanceMRCommentContext(noteData, mockCredentials);
      
      expect(result).toEqual({
        fileContext: {
          filePath: 'src/auth.js',
          lineNumber: 42,
          baseSha: 'abc123',
          headSha: 'def456',
          codeContext: expect.any(String)
        },
        threadContext: {
          discussionId: 'discussion-123',
          threadComments: expect.any(Array),
          totalComments: expect.any(Number)
        }
      });
    });

    it('should handle MR comments without position data', async () => {
      const noteData = {
        object_attributes: {
          id: 123,
          note: '@duo-agent General question about the MR',
          noteable_type: 'MergeRequest',
          discussion_id: 'discussion-123',
          position: null
        },
        merge_request: {
          iid: 1,
          title: 'Add authentication',
          description: 'Adding OAuth2 authentication'
        }
      };

      const mockCredentials = {
        token: 'test-token',
        url: 'https://gitlab.com',
        projectId: '123'
      };
      const result = await enhanceMRCommentContext(noteData, mockCredentials);
      
      expect(result).toEqual({
        fileContext: null,
        threadContext: {
          discussionId: 'discussion-123',
          threadComments: expect.any(Array),
          totalComments: expect.any(Number)
        }
      });
    });
  });
});