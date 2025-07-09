# GitLab Webhook Event Routing

## Overview

This document details the webhook event routing strategy for handling different GitLab events in the CloudFlare Workers environment.

## Event Flow Architecture

```
GitLab → Webhook → Worker Router → Event Handler → Container → Claude Code → GitLab API
```

## Router Implementation

### Main Webhook Handler
```typescript
// src/handlers/gitlab_webhook.ts
export async function handleGitLabWebhook(request: Request, env: Env): Promise<Response> {
  // 1. Verify webhook signature
  const signature = request.headers.get('X-Gitlab-Token')
  if (!verifyGitLabSignature(await request.text(), signature)) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  // 2. Parse webhook payload
  const payload = await request.json()
  
  // 3. Route based on event type
  const router = new GitLabEventRouter(env)
  return await router.route(payload)
}

class GitLabEventRouter {
  constructor(private env: Env) {}
  
  async route(payload: GitLabWebhookPayload): Promise<Response> {
    const { object_kind, object_attributes } = payload
    
    switch (object_kind) {
      case 'issue':
        return await this.handleIssueEvent(payload)
      case 'note':
        return await this.handleNoteEvent(payload)
      case 'merge_request':
        return await this.handleMergeRequestEvent(payload)
      default:
        return new Response('Event type not supported', { status: 200 })
    }
  }
}
```

## Event-Specific Handlers

### 1. Issue Events
```typescript
// src/handlers/gitlab_webhooks/issue.ts
export async function handleIssueEvent(payload: IssueEventPayload): Promise<Response> {
  const { object_attributes, project, user } = payload
  
  // Only process "opened" issues
  if (object_attributes.action !== 'open') {
    return new Response('Issue action not supported', { status: 200 })
  }
  
  // Skip if issue is created by a bot
  if (user.bot || user.username.includes('bot')) {
    return new Response('Bot issue ignored', { status: 200 })
  }
  
  // Prepare context for container
  const context = {
    processingMode: 'issue',
    issueIid: object_attributes.iid,
    issueTitle: object_attributes.title,
    issueDescription: object_attributes.description,
    projectId: project.id,
    projectNamespace: project.path_with_namespace,
    gitCloneUrl: project.git_http_url,
    authorUsername: user.username
  }
  
  // Invoke container
  return await invokeContainer(context, env)
}
```

### 2. Note Events (Comments)
```typescript
// src/handlers/gitlab_webhooks/note.ts
export async function handleNoteEvent(payload: NoteEventPayload): Promise<Response> {
  const { object_attributes, project, user } = payload
  
  // Skip system notes
  if (object_attributes.system) {
    return new Response('System note ignored', { status: 200 })
  }
  
  // Skip bot comments
  if (user.bot || user.username.includes('bot')) {
    return new Response('Bot comment ignored', { status: 200 })
  }
  
  // Check for @duo-agent mention
  if (!detectDuoAgentMention(object_attributes.note)) {
    return new Response('No @duo-agent mention found', { status: 200 })
  }
  
  // Rate limiting check
  const rateLimitKey = `${project.id}:${user.id}:${object_attributes.noteable_id}`
  if (await isRateLimited(rateLimitKey, env)) {
    return new Response('Rate limited', { status: 429 })
  }
  
  // Route based on noteable type
  switch (object_attributes.noteable_type) {
    case 'Issue':
      return await handleIssueComment(payload)
    case 'MergeRequest':
      return await handleMRComment(payload)
    default:
      return new Response('Noteable type not supported', { status: 200 })
  }
}

async function handleIssueComment(payload: NoteEventPayload): Promise<Response> {
  const { object_attributes, project, user, issue } = payload
  
  const context = {
    processingMode: 'issue_comment',
    userPrompt: extractUserPrompt(object_attributes.note),
    commentId: object_attributes.id,
    discussionId: object_attributes.discussion_id,
    authorUsername: user.username,
    projectId: project.id,
    projectNamespace: project.path_with_namespace,
    gitCloneUrl: project.git_http_url,
    issueIid: issue.iid,
    issueTitle: issue.title,
    issueDescription: issue.description
  }
  
  return await invokeContainer(context, env)
}

async function handleMRComment(payload: NoteEventPayload): Promise<Response> {
  const { object_attributes, project, user, merge_request } = payload
  
  const context = {
    processingMode: 'mr_comment',
    userPrompt: extractUserPrompt(object_attributes.note),
    commentId: object_attributes.id,
    discussionId: object_attributes.discussion_id,
    authorUsername: user.username,
    projectId: project.id,
    projectNamespace: project.path_with_namespace,
    gitCloneUrl: project.git_http_url,
    mrIid: merge_request.iid,
    mrTitle: merge_request.title,
    mrDescription: merge_request.description,
    sourceBranch: merge_request.source_branch,
    targetBranch: merge_request.target_branch,
    
    // Code context if available
    ...(object_attributes.position && {
      filePath: object_attributes.position.new_path,
      lineNumber: object_attributes.position.new_line,
      baseSha: object_attributes.position.base_sha,
      headSha: object_attributes.position.head_sha
    })
  }
  
  return await invokeContainer(context, env)
}
```

### 3. Merge Request Events
```typescript
// src/handlers/gitlab_webhooks/merge_request.ts
export async function handleMergeRequestEvent(payload: MergeRequestEventPayload): Promise<Response> {
  const { object_attributes, project, user } = payload
  
  // Only process "opened" MRs
  if (object_attributes.action !== 'open') {
    return new Response('MR action not supported', { status: 200 })
  }
  
  // Skip if MR is created by a bot
  if (user.bot || user.username.includes('bot')) {
    return new Response('Bot MR ignored', { status: 200 })
  }
  
  // Check if MR description contains @duo-agent
  if (!detectDuoAgentMention(object_attributes.description)) {
    return new Response('No @duo-agent mention in MR description', { status: 200 })
  }
  
  // Prepare context for container
  const context = {
    processingMode: 'mr_creation',
    userPrompt: extractUserPrompt(object_attributes.description),
    mrIid: object_attributes.iid,
    mrTitle: object_attributes.title,
    mrDescription: object_attributes.description,
    sourceBranch: object_attributes.source_branch,
    targetBranch: object_attributes.target_branch,
    projectId: project.id,
    projectNamespace: project.path_with_namespace,
    gitCloneUrl: project.git_http_url,
    authorUsername: user.username
  }
  
  return await invokeContainer(context, env)
}
```

## Utility Functions

### @duo-agent Detection
```typescript
function detectDuoAgentMention(text: string): boolean {
  if (!text) return false
  
  // Remove code blocks to avoid false positives
  const textWithoutCode = text
    .replace(/`[^`]+`/g, '') // Remove inline code
    .replace(/```[\s\S]*?```/gm, '') // Remove code blocks
  
  return /@duo-agent\b/i.test(textWithoutCode)
}

function extractUserPrompt(text: string): string {
  const match = text.match(/@duo-agent\s+(.+)/is)
  return match ? match[1].trim() : ''
}
```

### Rate Limiting
```typescript
async function isRateLimited(key: string, env: Env): Promise<boolean> {
  const rateLimitDO = env.RATE_LIMIT.get(env.RATE_LIMIT.idFromString(key))
  const response = await rateLimitDO.fetch('http://rate-limit/check', {
    method: 'POST',
    body: JSON.stringify({ key, limit: 5, window: 300 }) // 5 requests per 5 minutes
  })
  
  return response.status === 429
}
```

### Container Invocation
```typescript
async function invokeContainer(context: ContainerContext, env: Env): Promise<Response> {
  // Get container instance
  const containerDO = env.MY_CONTAINER.get(env.MY_CONTAINER.idFromString('gitlab-processor'))
  
  // Prepare environment variables
  const containerEnv = {
    GITLAB_URL: env.GITLAB_URL || 'https://gitlab.com',
    GITLAB_TOKEN: await getGitLabToken(env),
    ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
    ...context
  }
  
  // Invoke container
  const response = await containerDO.fetch('http://container/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(containerEnv)
  })
  
  if (response.ok) {
    return new Response('Processing started', { status: 202 })
  } else {
    return new Response('Container invocation failed', { status: 500 })
  }
}
```

## Event Filtering Logic

### Bot Detection
```typescript
function isBot(user: GitLabUser): boolean {
  return user.bot || 
         user.username.includes('bot') ||
         user.username.includes('gitlab-bot') ||
         user.username === 'ghost'
}
```

### System Note Detection
```typescript
function isSystemNote(note: GitLabNote): boolean {
  return note.system === true
}
```

### Duplicate Event Prevention
```typescript
async function isDuplicateEvent(eventId: string, env: Env): Promise<boolean> {
  const eventTracker = env.EVENT_TRACKER.get(env.EVENT_TRACKER.idFromString('events'))
  const response = await eventTracker.fetch('http://tracker/check', {
    method: 'POST',
    body: JSON.stringify({ eventId })
  })
  
  return response.status === 409 // Conflict = duplicate
}
```

## Error Handling

### Webhook Validation Errors
```typescript
enum WebhookError {
  INVALID_SIGNATURE = 'Invalid webhook signature',
  INVALID_PAYLOAD = 'Invalid JSON payload',
  MISSING_REQUIRED_FIELDS = 'Missing required fields',
  UNSUPPORTED_EVENT = 'Unsupported event type'
}

function handleWebhookError(error: WebhookError): Response {
  switch (error) {
    case WebhookError.INVALID_SIGNATURE:
      return new Response('Unauthorized', { status: 401 })
    case WebhookError.INVALID_PAYLOAD:
    case WebhookError.MISSING_REQUIRED_FIELDS:
      return new Response('Bad Request', { status: 400 })
    case WebhookError.UNSUPPORTED_EVENT:
      return new Response('OK', { status: 200 }) // Acknowledge but ignore
    default:
      return new Response('Internal Server Error', { status: 500 })
  }
}
```

### Container Invocation Errors
```typescript
async function handleContainerError(error: Error, context: ContainerContext): Promise<Response> {
  console.error('Container invocation failed:', error)
  
  // Post error message back to GitLab
  if (context.commentId) {
    await postErrorComment(context, error.message)
  }
  
  return new Response('Container processing failed', { status: 500 })
}
```

## Monitoring and Logging

### Event Metrics
```typescript
interface EventMetrics {
  eventType: string
  processingTime: number
  success: boolean
  errorType?: string
  projectId: string
  userId: string
}

function logEventMetrics(metrics: EventMetrics): void {
  console.log('WEBHOOK_METRICS', JSON.stringify(metrics))
}
```

### Health Checks
```typescript
export async function handleHealthCheck(): Promise<Response> {
  return new Response(JSON.stringify({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
```

## Configuration

### Environment Variables
```typescript
interface WebhookConfig {
  GITLAB_URL: string
  GITLAB_WEBHOOK_SECRET: string
  ANTHROPIC_API_KEY: string
  RATE_LIMIT_WINDOW: number
  RATE_LIMIT_MAX: number
  BOT_USERNAMES: string[] // Comma-separated list
}
```

### Feature Flags
```typescript
interface FeatureFlags {
  ENABLE_ISSUE_PROCESSING: boolean
  ENABLE_COMMENT_PROCESSING: boolean
  ENABLE_MR_PROCESSING: boolean
  ENABLE_RATE_LIMITING: boolean
  ENABLE_DUPLICATE_DETECTION: boolean
}
```

This webhook routing system provides:
- **Event-specific handling** for each GitLab webhook type
- **Intelligent filtering** to prevent spam and loops
- **Rate limiting** to prevent abuse
- **Comprehensive error handling** with user feedback
- **Monitoring and logging** for operational visibility
- **Feature flags** for gradual rollouts