# GitLab Integration Technical Specifications

## Overview

This document provides detailed technical specifications for adapting the CloudFlare Workers container project to support comprehensive GitLab integration with multiple trigger types.

## Architecture Overview

```
GitLab → Webhook → CloudFlare Worker → Container → Claude Code → GitLab API
```

### Current Dependencies
- **Worker**: `@cloudflare/containers: 0.0.8`, `@tsndr/cloudflare-worker-jwt: ^3.2.0`
- **Container**: `@anthropic-ai/claude-code: ^1.0.27`, `@octokit/rest: ^22.0.0`

### Required New Dependencies
- **Container**: `@gitbeaker/rest` (GitLab API client to replace @octokit/rest)
- **Worker**: No new dependencies needed

## Trigger Types Specification

### 1. GitLab Issues (GitHub Parity)
**Webhook Event:** `issues`
**Trigger Condition:** `action: "open"`
**Processing:** Auto-process new issues similar to current GitHub implementation

**Webhook Payload Structure:**
```json
{
  "object_kind": "issue",
  "event_type": "issue", 
  "object_attributes": {
    "action": "open",
    "id": 123,
    "iid": 1,
    "title": "Fix login bug",
    "description": "Users can't login with OAuth...",
    "author_id": 456,
    "project_id": 789,
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z",
    "state": "opened",
    "labels": []
  },
  "user": {
    "id": 456,
    "username": "developer",
    "name": "Developer Name"
  },
  "project": {
    "id": 789,
    "name": "my-project",
    "path_with_namespace": "group/my-project",
    "web_url": "https://gitlab.com/group/my-project",
    "git_ssh_url": "git@gitlab.com:group/my-project.git",
    "git_http_url": "https://gitlab.com/group/my-project.git"
  }
}
```

### 2. GitLab Issue Comments (@duo-agent)
**Webhook Event:** `note`
**Trigger Condition:** `noteable_type: "Issue"` AND contains `@duo-agent`
**Processing:** Parse user prompt and execute in issue context

**Webhook Payload Structure:**
```json
{
  "object_kind": "note",
  "event_type": "note",
  "object_attributes": {
    "id": 123,
    "note": "@duo-agent Please help me understand this error",
    "noteable_type": "Issue",
    "author_id": 456,
    "created_at": "2025-01-01T00:00:00Z",
    "system": false,
    "noteable_id": 789,
    "discussion_id": "abc123"
  },
  "user": {
    "id": 456,
    "username": "developer",
    "name": "Developer Name"
  },
  "project": {
    "id": 789,
    "name": "my-project",
    "path_with_namespace": "group/my-project"
  },
  "issue": {
    "id": 789,
    "iid": 1,
    "title": "Fix login bug",
    "description": "Users can't login..."
  }
}
```

### 3. GitLab MR Comments (@duo-agent)
**Webhook Event:** `note`
**Trigger Condition:** `noteable_type: "MergeRequest"` AND contains `@duo-agent`
**Processing:** Parse user prompt and execute in MR context with code access

**Webhook Payload Structure:**
```json
{
  "object_kind": "note",
  "event_type": "note",
  "object_attributes": {
    "id": 123,
    "note": "@duo-agent Can you review this function?",
    "noteable_type": "MergeRequest",
    "author_id": 456,
    "created_at": "2025-01-01T00:00:00Z",
    "system": false,
    "noteable_id": 789,
    "discussion_id": "abc123",
    "position": {
      "base_sha": "abc123",
      "head_sha": "def456",
      "start_sha": "abc123",
      "new_path": "src/auth.js",
      "old_path": "src/auth.js",
      "new_line": 42,
      "old_line": 42
    }
  },
  "user": {
    "id": 456,
    "username": "developer",
    "name": "Developer Name"
  },
  "project": {
    "id": 789,
    "name": "my-project",
    "path_with_namespace": "group/my-project"
  },
  "merge_request": {
    "id": 789,
    "iid": 1,
    "title": "Add OAuth authentication",
    "description": "Implementing OAuth2 flow...",
    "source_branch": "feature/oauth",
    "target_branch": "main",
    "source_project_id": 789,
    "target_project_id": 789
  }
}
```

### 4. GitLab MR Creation
**Webhook Event:** `merge_request`
**Trigger Condition:** `action: "open"` AND description contains `@duo-agent`
**Processing:** Parse MR description for Claude instructions

**Webhook Payload Structure:**
```json
{
  "object_kind": "merge_request",
  "event_type": "merge_request",
  "object_attributes": {
    "id": 123,
    "iid": 1,
    "title": "Implement user authentication",
    "description": "@duo-agent Please implement OAuth2 authentication with the following requirements...",
    "source_branch": "feature/auth",
    "target_branch": "main",
    "source_project_id": 789,
    "target_project_id": 789,
    "author_id": 456,
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z",
    "state": "opened",
    "action": "open"
  },
  "user": {
    "id": 456,
    "username": "developer",
    "name": "Developer Name"
  },
  "project": {
    "id": 789,
    "name": "my-project",
    "path_with_namespace": "group/my-project"
  }
}
```

## Authentication Strategy

### GitLab Personal Access Tokens
- **Scope Required:** `api` (full API access)
- **Storage:** Encrypted in GitLabAppConfigDO (Durable Object)
- **Verification:** Direct token comparison for webhook authentication

### Environment Variables
```
GITLAB_URL=https://gitlab.com
GITLAB_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx
GITLAB_PROJECT_ID=123456789
GITLAB_WEBHOOK_SECRET=webhook_secret_key
```

### Webhook Authentication
- **Method:** GitLab sends `X-Gitlab-Token` header
- **Verification:** Direct string comparison (not HMAC like GitHub)
- **Implementation:** `verify_gitlab_webhook(request.headers.get('X-Gitlab-Token'))`

## Event Routing Logic

### Worker Layer Routing
```typescript
// src/handlers/gitlab_webhook.ts
export async function handleGitLabWebhook(request: Request, env: Env): Promise<Response> {
  const payload = await request.json()
  
  switch (payload.object_kind) {
    case 'issue':
      if (payload.object_attributes.action === 'open') {
        return handleIssueCreated(payload, env)
      }
      break
      
    case 'note':
      if (payload.object_attributes.noteable_type === 'Issue') {
        return handleIssueComment(payload, env)
      } else if (payload.object_attributes.noteable_type === 'MergeRequest') {
        return handleMRComment(payload, env)
      }
      break
      
    case 'merge_request':
      if (payload.object_attributes.action === 'open') {
        return handleMRCreated(payload, env)
      }
      break
  }
  
  return new Response('Event not handled', { status: 200 })
}
```

### Container Processing Modes
```typescript
// container_src/src/main.ts
enum ProcessingMode {
  ISSUE = 'issue',
  ISSUE_COMMENT = 'issue_comment',
  MR_COMMENT = 'mr_comment',
  MR_CREATION = 'mr_creation'
}

async function processRequest(mode: ProcessingMode, context: any) {
  switch (mode) {
    case ProcessingMode.ISSUE:
      return await processIssue(context)
    case ProcessingMode.ISSUE_COMMENT:
      return await processIssueComment(context)
    case ProcessingMode.MR_COMMENT:
      return await processMRComment(context)
    case ProcessingMode.MR_CREATION:
      return await processMRCreation(context)
  }
}
```

## Comment Parsing Strategy

### @duo-agent Detection
```typescript
function detectDuoAgentMention(text: string): boolean {
  // Remove code blocks to avoid false positives
  const textWithoutCode = text
    .replace(/`[^`]+`/g, '') // Remove inline code
    .replace(/```[\s\S]*?```/gm, '') // Remove code blocks
  
  return /@duo-agent\b/i.test(textWithoutCode)
}

function extractUserPrompt(text: string): string {
  const match = text.match(/@duo-agent\s+(.+)/i)
  return match ? match[1].trim() : ''
}
```

### Context Extraction
```typescript
interface CommentContext {
  userPrompt: string
  commentId: string
  discussionId?: string
  authorUsername: string
  projectId: string
  
  // Issue-specific
  issueIid?: number
  issueTitle?: string
  issueDescription?: string
  
  // MR-specific
  mrIid?: number
  mrTitle?: string
  mrDescription?: string
  sourceBranch?: string
  targetBranch?: string
  
  // Code location (for MR comments)
  filePath?: string
  lineNumber?: number
  codeContext?: string
}
```

## Container Communication Protocol

### Environment Variables Passed to Container
```typescript
interface ContainerEnvironment {
  // Authentication
  GITLAB_URL: string
  GITLAB_TOKEN: string
  GITLAB_PROJECT_ID: string
  
  // Processing context
  PROCESSING_MODE: string // 'issue' | 'issue_comment' | 'mr_comment' | 'mr_creation'
  USER_PROMPT?: string // For comment processing
  
  // Issue context
  ISSUE_IID?: string
  ISSUE_TITLE?: string
  ISSUE_DESCRIPTION?: string
  
  // MR context
  MR_IID?: string
  MR_TITLE?: string
  MR_DESCRIPTION?: string
  SOURCE_BRANCH?: string
  TARGET_BRANCH?: string
  
  // Comment context
  COMMENT_ID?: string
  DISCUSSION_ID?: string
  COMMENT_AUTHOR?: string
  
  // Code context (for MR comments)
  FILE_PATH?: string
  LINE_NUMBER?: string
  
  // Project context
  PROJECT_NAMESPACE: string
  GIT_CLONE_URL: string
  
  // Claude configuration
  ANTHROPIC_API_KEY: string
}
```

### Response Format
```typescript
interface ContainerResponse {
  success: boolean
  message?: string
  error?: string
  
  // Actions taken
  actions: {
    type: 'comment' | 'merge_request' | 'commit'
    target: string // comment ID, MR IID, etc.
    content: string
  }[]
  
  // Metadata
  processing_time: number
  claude_turns_used: number
}
```

## Error Handling Strategy

### Webhook Validation
- Invalid signature → 401 Unauthorized
- Missing required fields → 400 Bad Request
- Unsupported event type → 200 OK (ignored)

### Container Failures
- Container startup failure → Retry with exponential backoff
- Claude API errors → Return error comment to user
- GitLab API errors → Log and notify user

### Rate Limiting
- Implement cooldown periods (30s per user per project)
- Track recent triggers in Durable Objects
- Return 429 Too Many Requests when rate limited

## Performance Considerations

### Connection Pooling
- Use connection pooling for GitLab API calls
- Implement retry logic with exponential backoff
- Cache frequently accessed data (project info, user info)

### Container Optimization
- Pre-warm containers when possible
- Optimize Claude Code workspace setup
- Use git shallow clones for faster startup

### Monitoring
- Track webhook processing times
- Monitor container startup/execution times
- Log API call frequencies and errors

## Security Considerations

### Token Security
- Store GitLab tokens encrypted in Durable Objects
- Use minimal required scopes
- Implement token rotation capability

### Webhook Security
- Validate webhook signatures
- Implement replay attack protection
- Rate limit webhook endpoints

### Container Security
- Run containers with minimal privileges
- Sanitize user input before processing
- Implement timeout limits for Claude operations

## Testing Strategy

### Unit Tests
- Webhook payload parsing
- Comment parsing and extraction
- Authentication logic
- Event routing

### Integration Tests
- End-to-end webhook processing
- GitLab API integration
- Container communication
- Error handling scenarios

### Load Tests
- Concurrent webhook processing
- Container scaling under load
- Rate limiting effectiveness