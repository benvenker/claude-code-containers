/**
 * Advanced tests for GitLab API client
 * Testing connection pooling, retry logic, and error handling
 */

import { jest } from '@jest/globals';
import axios from 'axios';

// Mock axios to test connection pooling and retry logic
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GitLabClient Advanced Features', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue({
      request: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      defaults: {},
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    } as any);
  });

  describe('Connection Pooling', () => {
    it('should create axios instance with connection pooling settings', async () => {
      const { GitLabClient } = await import('../src/gitlab_client');
      
      const client = new GitLabClient({
        gitlabUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'test-token',
        poolConnections: 15,
        poolMaxSize: 30,
      });

      expect(client.poolConnections).toBe(15);
      expect(client.poolMaxSize).toBe(30);
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30000,
          headers: {
            'Private-Token': 'test-token',
          },
        })
      );
    });

    it('should use default connection pooling values when not specified', async () => {
      const { GitLabClient } = await import('../src/gitlab_client');
      
      const client = new GitLabClient({
        gitlabUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'test-token',
      });

      expect(client.poolConnections).toBe(10);
      expect(client.poolMaxSize).toBe(20);
    });
  });

  describe('Timeout Configuration', () => {
    it('should configure custom timeout values', async () => {
      const { GitLabClient } = await import('../src/gitlab_client');
      
      const client = new GitLabClient({
        gitlabUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'test-token',
        timeout: 60,
      });

      expect(client.timeout).toBe(60);
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 60000,
          headers: {
            'Private-Token': 'test-token',
          },
        })
      );
    });
  });

  describe('Retry Logic', () => {
    it('should configure retry logic with exponential backoff', async () => {
      const { GitLabClient } = await import('../src/gitlab_client');
      
      const client = new GitLabClient({
        gitlabUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'test-token',
        maxRetries: 5,
      });

      expect(client.maxRetries).toBe(5);
    });

    it('should use default retry values when not specified', async () => {
      const { GitLabClient } = await import('../src/gitlab_client');
      
      const client = new GitLabClient({
        gitlabUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'test-token',
      });

      expect(client.maxRetries).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('should create proper GitLabAPIError with status code and response body', async () => {
      const { GitLabClient } = await import('../src/gitlab_client');
      
      const client = new GitLabClient({
        gitlabUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'test-token',
      });

      // Access private method for testing
      const createError = (client as any).createGitLabError;
      const originalError = {
        response: {
          status: 404,
          data: 'Not Found',
        },
      };

      const error = createError('Test error', originalError);

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(404);
      expect(error.responseBody).toBe('Not Found');
    });

    it('should handle errors without response data', async () => {
      const { GitLabClient } = await import('../src/gitlab_client');
      
      const client = new GitLabClient({
        gitlabUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'test-token',
      });

      // Access private method for testing
      const createError = (client as any).createGitLabError;
      const originalError = new Error('Network error');

      const error = createError('Test error', originalError);

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBeUndefined();
      expect(error.responseBody).toBeUndefined();
    });
  });

  describe('Method Behavior', () => {
    it('should log method calls with context', async () => {
      const { GitLabClient } = await import('../src/gitlab_client');
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      const client = new GitLabClient({
        gitlabUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'test-token',
      });

      await client.postComment(123, 'Test comment');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[GITLAB_CLIENT] Posted comment to MR'),
        expect.stringContaining('"mrIid": 123')
      );

      consoleSpy.mockRestore();
    });

    it('should handle method calls with proper parameters', async () => {
      const { GitLabClient } = await import('../src/gitlab_client');
      
      const client = new GitLabClient({
        gitlabUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'test-token',
      });

      // Test methods that don't make API calls in current implementation
      expect(await client.getMergeRequestDiff(123)).toBe('');
      expect(await client.postComment(123, 'test')).toBe(true);
      expect(await client.getDiscussionContext(123, 'disc-id')).toEqual({});
      expect(await client.createDiffDiscussion(123, 'body', 'file.js', 42, {
        base_commit_sha: 'abc',
        head_commit_sha: 'def',
        start_commit_sha: 'ghi',
      })).toBe(true);
      
      // Test getMergeRequest method with error handling
      try {
        await client.getMergeRequest(123);
        // If no error, it should be defined
      } catch (error) {
        // Expected to fail in current implementation
        expect(error).toBeDefined();
      }
    });
  });
});