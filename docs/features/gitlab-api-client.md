# GitLab API Client Feature

## Overview
Implementing Phase 2.2 of the GitLab integration plan: Create a GitLab API client to replace the current GitHub client functionality for GitLab operations.

## Requirements from Plan.md
- Create `container_src/src/gitlab_client.ts` 
- Implement connection pooling (based on gitlab-claude patterns)
- Add retry logic and error handling
- Create methods for issues, comments, MRs

## Reference Implementation Analysis
Based on `/Users/ben/code/gitlab-claude/orchestrator/gitlab_client.py`:

### Key Features to Implement:
1. **Connection pooling** - Using requests session with HTTPAdapter
2. **Retry logic** - Exponential backoff for 429, 500, 502, 503, 504 errors
3. **Error handling** - Custom GitLabAPIError with status codes
4. **Authentication** - Personal Access Token via Private-Token header
5. **Core methods**:
   - `get_merge_request(mr_iid)` - Get MR by internal ID
   - `get_merge_request_diff(mr_iid)` - Get MR diff content
   - `post_comment(mr_iid, comment)` - Post comment to MR
   - `get_discussion_context(mr_iid, discussion_id)` - Get discussion thread
   - `create_diff_discussion(mr_iid, body, file_path, line_number, commit_shas)` - Line-specific comments

### TypeScript Adaptation:
- Use `@gitbeaker/rest` instead of `python-gitlab`
- Use `node-fetch` or `axios` for HTTP requests with connection pooling
- Implement similar retry logic with exponential backoff
- Mirror the Python client's interface but with TypeScript types

## Current State
- `container_src/src/github_client.ts` exists with Octokit for GitHub
- Need to create equivalent GitLab client with `@gitbeaker/rest`
- Package.json needs new dependencies

## Dependencies to Add
- `@gitbeaker/rest` - GitLab API client
- `axios` - HTTP client with connection pooling support
- `@types/node` - Already present for TypeScript support

## TDD Approach
1. **RED**: Write failing tests for GitLab client initialization and core methods
2. **GREEN**: Implement minimal functionality to pass tests
3. **REFACTOR**: Improve code quality, add proper error handling and connection pooling

## Test Strategy
Following the reference test structure from `gitlab-claude/tests/test_gitlab_client.py`:
- Test client initialization with URL, project ID, and token
- Test method existence for all core operations
- Test connection pooling configuration
- Test retry logic with mocked 429 responses
- Test error handling for various API failures

## Implementation Notes
- Use TypeScript interfaces for strong typing
- Implement connection pooling using axios interceptors
- Add proper logging similar to GitHub client
- Include timeout configuration
- Follow same error handling pattern as GitHub client