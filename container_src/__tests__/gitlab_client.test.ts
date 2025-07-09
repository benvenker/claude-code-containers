/**
 * Tests for GitLab API client
 * Following TDD approach - these tests are written before implementation
 */

import { jest } from '@jest/globals';

describe('GitLabClient', () => {
  describe('Basic existence and initialization', () => {
    it('should be importable from gitlab_client module', async () => {
      // RED: This should fail because gitlab_client.ts doesn't exist yet
      const { GitLabClient } = await import('../src/gitlab_client');
      expect(GitLabClient).toBeDefined();
    });

    it('should initialize with required parameters', async () => {
      // RED: This should fail because GitLabClient doesn't exist yet
      const { GitLabClient } = await import('../src/gitlab_client');
      
      const client = new GitLabClient({
        gitlabUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'test-token'
      });

      expect(client).toBeDefined();
      expect(client.gitlabUrl).toBe('https://gitlab.com');
      expect(client.projectId).toBe('12345');
      expect(client.token).toBe('test-token');
    });

    it('should initialize with optional connection pooling parameters', async () => {
      const { GitLabClient } = await import('../src/gitlab_client');
      
      const client = new GitLabClient({
        gitlabUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'test-token',
        timeout: 45,
        maxRetries: 5,
        poolConnections: 15,
        poolMaxSize: 30
      });

      expect(client.timeout).toBe(45);
      expect(client.maxRetries).toBe(5);
      expect(client.poolConnections).toBe(15);
      expect(client.poolMaxSize).toBe(30);
    });

    it('should have default values for optional parameters', async () => {
      const { GitLabClient } = await import('../src/gitlab_client');
      
      const client = new GitLabClient({
        gitlabUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'test-token'
      });

      expect(client.timeout).toBe(30);
      expect(client.maxRetries).toBe(3);
      expect(client.poolConnections).toBe(10);
      expect(client.poolMaxSize).toBe(20);
    });
  });

  describe('Core methods existence', () => {
    it('should have getMergeRequest method', async () => {
      const { GitLabClient } = await import('../src/gitlab_client');
      
      const client = new GitLabClient({
        gitlabUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'test-token'
      });

      expect(client.getMergeRequest).toBeDefined();
      expect(typeof client.getMergeRequest).toBe('function');
    });

    it('should have getMergeRequestDiff method', async () => {
      const { GitLabClient } = await import('../src/gitlab_client');
      
      const client = new GitLabClient({
        gitlabUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'test-token'
      });

      expect(client.getMergeRequestDiff).toBeDefined();
      expect(typeof client.getMergeRequestDiff).toBe('function');
    });

    it('should have postComment method', async () => {
      const { GitLabClient } = await import('../src/gitlab_client');
      
      const client = new GitLabClient({
        gitlabUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'test-token'
      });

      expect(client.postComment).toBeDefined();
      expect(typeof client.postComment).toBe('function');
    });

    it('should have getDiscussionContext method', async () => {
      const { GitLabClient } = await import('../src/gitlab_client');
      
      const client = new GitLabClient({
        gitlabUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'test-token'
      });

      expect(client.getDiscussionContext).toBeDefined();
      expect(typeof client.getDiscussionContext).toBe('function');
    });

    it('should have createDiffDiscussion method', async () => {
      const { GitLabClient } = await import('../src/gitlab_client');
      
      const client = new GitLabClient({
        gitlabUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'test-token'
      });

      expect(client.createDiffDiscussion).toBeDefined();
      expect(typeof client.createDiffDiscussion).toBe('function');
    });

    it('should have close method for cleanup', async () => {
      const { GitLabClient } = await import('../src/gitlab_client');
      
      const client = new GitLabClient({
        gitlabUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'test-token'
      });

      expect(client.close).toBeDefined();
      expect(typeof client.close).toBe('function');
    });
  });
});