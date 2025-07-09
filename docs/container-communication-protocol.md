# Container Communication Protocol

## Overview

This document defines the communication protocol between the CloudFlare Worker and the containerized Claude Code execution environment for GitLab integration.

## Protocol Architecture

```
Worker → HTTP Request → Container → Claude Code → GitLab API → Response → Worker
```

## Request/Response Flow

### 1. Worker to Container Communication

The Worker sends HTTP requests to the container with all necessary context and credentials.

#### Request Format

```typescript
interface ContainerRequest {
  method: 'POST'
  url: 'http://container/process'
  headers: {
    'Content-Type': 'application/json'
    'X-Request-ID': string  // Unique request identifier
  }
  body: ContainerContext
}

interface ContainerContext {
  // Processing configuration
  processingMode: 'issue' | 'issue_comment' | 'mr_comment' | 'mr_creation'
  requestId: string
  
  // GitLab authentication
  gitlabUrl: string
  gitlabToken: string
  gitlabProjectId: string
  
  // Claude configuration
  anthropicApiKey: string
  maxTurns?: number
  
  // Project context
  projectNamespace: string
  gitCloneUrl: string
  
  // User context
  authorUsername: string
  userPrompt?: string  // For comment-based processing
  
  // Issue-specific context
  issueIid?: number
  issueTitle?: string
  issueDescription?: string
  
  // MR-specific context
  mrIid?: number
  mrTitle?: string
  mrDescription?: string
  sourceBranch?: string
  targetBranch?: string
  
  // Comment-specific context
  commentId?: string
  discussionId?: string
  
  // Code location context (for MR comments)
  filePath?: string
  lineNumber?: number
  baseSha?: string
  headSha?: string
}
```

#### Response Format

```typescript
interface ContainerResponse {
  success: boolean
  requestId: string
  processingTime: number
  claudeTurnsUsed: number
  
  // Success response
  result?: {
    message: string
    actions: ProcessingAction[]
    metadata: ProcessingMetadata
  }
  
  // Error response
  error?: {
    code: string
    message: string
    details?: any
  }
}

interface ProcessingAction {
  type: 'comment' | 'merge_request' | 'commit' | 'branch_create'
  target: string  // Comment ID, MR IID, branch name, etc.
  content: string
  success: boolean
  url?: string    // GitLab URL for created resource
}

interface ProcessingMetadata {
  workspaceUsed: boolean
  filesModified: string[]
  branchesCreated: string[]
  commitsCreated: string[]
  gitlabApiCalls: number
}
```

### 2. Container Processing Modes

#### Issue Processing Mode
```typescript
// processingMode: 'issue'
interface IssueContext extends ContainerContext {
  processingMode: 'issue'
  issueIid: number
  issueTitle: string
  issueDescription: string
  
  // Optional: referenced from current GitHub implementation
  assignees?: string[]
  labels?: string[]
}

// Expected actions:
// - Create workspace
// - Analyze issue
// - Implement solution
// - Create MR or comment with results
```

#### Issue Comment Processing Mode
```typescript
// processingMode: 'issue_comment'
interface IssueCommentContext extends ContainerContext {
  processingMode: 'issue_comment'
  userPrompt: string
  commentId: string
  discussionId?: string
  issueIid: number
  issueTitle: string
  issueDescription: string
}

// Expected actions:
// - Parse user prompt
// - Execute in issue context
// - Reply to comment thread
```

#### MR Comment Processing Mode
```typescript
// processingMode: 'mr_comment'
interface MRCommentContext extends ContainerContext {
  processingMode: 'mr_comment'
  userPrompt: string
  commentId: string
  discussionId?: string
  mrIid: number
  mrTitle: string
  mrDescription: string
  sourceBranch: string
  targetBranch: string
  
  // Code location (if comment is on specific code)
  filePath?: string
  lineNumber?: number
  baseSha?: string
  headSha?: string
}

// Expected actions:
// - Parse user prompt
// - Execute in MR context with code access
// - Reply to discussion thread
```

#### MR Creation Processing Mode
```typescript
// processingMode: 'mr_creation'
interface MRCreationContext extends ContainerContext {
  processingMode: 'mr_creation'
  userPrompt: string  // Extracted from MR description
  mrIid: number
  mrTitle: string
  mrDescription: string
  sourceBranch: string
  targetBranch: string
}

// Expected actions:
// - Parse instructions from MR description
// - Execute work on source branch
// - Update MR with progress/results
```

## Container Implementation

### HTTP Server Structure

```typescript
// container_src/src/main.ts
import express from 'express'
import { processGitLabRequest } from './gitlab_processor'

const app = express()
app.use(express.json({ limit: '10mb' }))

app.post('/process', async (req, res) => {
  const startTime = Date.now()
  
  try {
    const context: ContainerContext = req.body
    const result = await processGitLabRequest(context)
    
    const response: ContainerResponse = {
      success: true,
      requestId: context.requestId,
      processingTime: Date.now() - startTime,
      claudeTurnsUsed: result.claudeTurnsUsed,
      result: result
    }
    
    res.json(response)
  } catch (error) {
    const response: ContainerResponse = {
      success: false,
      requestId: req.body.requestId,
      processingTime: Date.now() - startTime,
      claudeTurnsUsed: 0,
      error: {
        code: error.code || 'PROCESSING_ERROR',
        message: error.message,
        details: error.details
      }
    }
    
    res.status(500).json(response)
  }
})

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() })
})

const PORT = process.env.PORT || 8080
app.listen(PORT, () => {
  console.log(`Container listening on port ${PORT}`)
})
```

### GitLab Request Processor

```typescript
// container_src/src/gitlab_processor.ts
import { ClaudeCodeClient } from './claude_client'
import { GitLabClient } from './gitlab_client'
import { WorkspaceManager } from './workspace_manager'

export async function processGitLabRequest(context: ContainerContext): Promise<ProcessingResult> {
  const processor = new GitLabProcessor(context)
  return await processor.process()
}

class GitLabProcessor {
  private claudeClient: ClaudeCodeClient
  private gitlabClient: GitLabClient
  private workspaceManager: WorkspaceManager
  
  constructor(private context: ContainerContext) {
    this.claudeClient = new ClaudeCodeClient(context.anthropicApiKey)
    this.gitlabClient = new GitLabClient(context.gitlabUrl, context.gitlabToken)
    this.workspaceManager = new WorkspaceManager(context.gitCloneUrl)
  }
  
  async process(): Promise<ProcessingResult> {
    switch (this.context.processingMode) {
      case 'issue':
        return await this.processIssue()
      case 'issue_comment':
        return await this.processIssueComment()
      case 'mr_comment':
        return await this.processMRComment()
      case 'mr_creation':
        return await this.processMRCreation()
      default:
        throw new Error(`Unsupported processing mode: ${this.context.processingMode}`)
    }
  }
  
  private async processIssue(): Promise<ProcessingResult> {
    const { issueIid, issueTitle, issueDescription } = this.context
    
    // Setup workspace
    const workspace = await this.workspaceManager.createWorkspace()
    
    // Prepare Claude prompt
    const prompt = this.buildIssuePrompt(issueTitle, issueDescription)
    
    // Execute Claude Code
    const claudeResult = await this.claudeClient.execute(prompt, workspace)
    
    // Check for code changes
    const hasChanges = await this.workspaceManager.hasChanges()
    
    if (hasChanges) {
      // Create feature branch and MR
      const branchName = `claude/issue-${issueIid}`
      await this.workspaceManager.createBranch(branchName)
      await this.workspaceManager.commitChanges(`Fix issue #${issueIid}: ${issueTitle}`)
      await this.workspaceManager.push(branchName)
      
      // Create MR
      const mrResult = await this.gitlabClient.createMergeRequest({
        sourceBranch: branchName,
        targetBranch: 'main',
        title: `Fix issue #${issueIid}: ${issueTitle}`,
        description: `This MR addresses issue #${issueIid}.\n\n${claudeResult.summary}`
      })
      
      return {
        message: `Created MR #${mrResult.iid} to fix issue #${issueIid}`,
        actions: [
          {
            type: 'merge_request',
            target: mrResult.iid.toString(),
            content: mrResult.description,
            success: true,
            url: mrResult.web_url
          }
        ],
        metadata: {
          workspaceUsed: true,
          filesModified: await this.workspaceManager.getModifiedFiles(),
          branchesCreated: [branchName],
          commitsCreated: [await this.workspaceManager.getLastCommitSha()],
          gitlabApiCalls: 1
        },
        claudeTurnsUsed: claudeResult.turnsUsed
      }
    } else {
      // Post analysis as comment
      const commentResult = await this.gitlabClient.createIssueComment(
        issueIid,
        `## 🤖 Claude Analysis\n\n${claudeResult.response}`
      )
      
      return {
        message: `Posted analysis comment on issue #${issueIid}`,
        actions: [
          {
            type: 'comment',
            target: commentResult.id.toString(),
            content: claudeResult.response,
            success: true,
            url: commentResult.web_url
          }
        ],
        metadata: {
          workspaceUsed: true,
          filesModified: [],
          branchesCreated: [],
          commitsCreated: [],
          gitlabApiCalls: 1
        },
        claudeTurnsUsed: claudeResult.turnsUsed
      }
    }
  }
  
  private async processIssueComment(): Promise<ProcessingResult> {
    const { userPrompt, commentId, discussionId, issueIid } = this.context
    
    // Setup workspace for context
    const workspace = await this.workspaceManager.createWorkspace()
    
    // Build contextual prompt
    const prompt = this.buildCommentPrompt(userPrompt, 'issue', workspace)
    
    // Execute Claude Code
    const claudeResult = await this.claudeClient.execute(prompt, workspace)
    
    // Reply to discussion
    const replyResult = await this.gitlabClient.replyToDiscussion(
      issueIid,
      discussionId,
      `## 🤖 Claude Response\n\n${claudeResult.response}`
    )
    
    return {
      message: `Replied to comment on issue #${issueIid}`,
      actions: [
        {
          type: 'comment',
          target: replyResult.id.toString(),
          content: claudeResult.response,
          success: true,
          url: replyResult.web_url
        }
      ],
      metadata: {
        workspaceUsed: true,
        filesModified: [],
        branchesCreated: [],
        commitsCreated: [],
        gitlabApiCalls: 1
      },
      claudeTurnsUsed: claudeResult.turnsUsed
    }
  }
  
  private async processMRComment(): Promise<ProcessingResult> {
    const { userPrompt, commentId, discussionId, mrIid, sourceBranch, filePath, lineNumber } = this.context
    
    // Setup workspace on source branch
    const workspace = await this.workspaceManager.createWorkspace(sourceBranch)
    
    // Build contextual prompt with code location
    const prompt = this.buildMRCommentPrompt(userPrompt, filePath, lineNumber, workspace)
    
    // Execute Claude Code
    const claudeResult = await this.claudeClient.execute(prompt, workspace)
    
    // Check for code changes
    const hasChanges = await this.workspaceManager.hasChanges()
    
    if (hasChanges) {
      // Commit changes to source branch
      await this.workspaceManager.commitChanges(`Update based on MR comment feedback`)
      await this.workspaceManager.push(sourceBranch)
    }
    
    // Reply to discussion
    const replyResult = await this.gitlabClient.replyToDiscussion(
      mrIid,
      discussionId,
      `## 🤖 Claude Response\n\n${claudeResult.response}`,
      'MergeRequest'
    )
    
    return {
      message: `Replied to MR #${mrIid} comment`,
      actions: [
        {
          type: 'comment',
          target: replyResult.id.toString(),
          content: claudeResult.response,
          success: true,
          url: replyResult.web_url
        },
        ...(hasChanges ? [
          {
            type: 'commit',
            target: sourceBranch,
            content: 'Updated code based on feedback',
            success: true,
            url: await this.workspaceManager.getCommitUrl()
          }
        ] : [])
      ],
      metadata: {
        workspaceUsed: true,
        filesModified: hasChanges ? await this.workspaceManager.getModifiedFiles() : [],
        branchesCreated: [],
        commitsCreated: hasChanges ? [await this.workspaceManager.getLastCommitSha()] : [],
        gitlabApiCalls: 1
      },
      claudeTurnsUsed: claudeResult.turnsUsed
    }
  }
  
  private async processMRCreation(): Promise<ProcessingResult> {
    const { userPrompt, mrIid, sourceBranch, targetBranch } = this.context
    
    // Setup workspace on source branch
    const workspace = await this.workspaceManager.createWorkspace(sourceBranch)
    
    // Build prompt from MR description
    const prompt = this.buildMRCreationPrompt(userPrompt, workspace)
    
    // Execute Claude Code
    const claudeResult = await this.claudeClient.execute(prompt, workspace)
    
    // Check for code changes
    const hasChanges = await this.workspaceManager.hasChanges()
    
    if (hasChanges) {
      // Commit changes to source branch
      await this.workspaceManager.commitChanges(`Implement MR requirements`)
      await this.workspaceManager.push(sourceBranch)
    }
    
    // Update MR with progress
    const updateResult = await this.gitlabClient.updateMergeRequest(mrIid, {
      description: `${this.context.mrDescription}\n\n## 🤖 Claude Progress\n\n${claudeResult.response}`
    })
    
    return {
      message: `Updated MR #${mrIid} with implementation`,
      actions: [
        {
          type: 'merge_request',
          target: mrIid.toString(),
          content: `Updated with Claude implementation`,
          success: true,
          url: updateResult.web_url
        },
        ...(hasChanges ? [
          {
            type: 'commit',
            target: sourceBranch,
            content: 'Implemented MR requirements',
            success: true,
            url: await this.workspaceManager.getCommitUrl()
          }
        ] : [])
      ],
      metadata: {
        workspaceUsed: true,
        filesModified: hasChanges ? await this.workspaceManager.getModifiedFiles() : [],
        branchesCreated: [],
        commitsCreated: hasChanges ? [await this.workspaceManager.getLastCommitSha()] : [],
        gitlabApiCalls: 1
      },
      claudeTurnsUsed: claudeResult.turnsUsed
    }
  }
}
```

## Environment Variable Mapping

### Worker to Container Mapping

```typescript
function buildContainerContext(
  webhookPayload: GitLabWebhookPayload,
  credentials: GitLabCredentials
): ContainerContext {
  return {
    // Processing configuration
    processingMode: determineProcessingMode(webhookPayload),
    requestId: generateRequestId(),
    
    // GitLab authentication
    gitlabUrl: credentials.url,
    gitlabToken: credentials.token,
    gitlabProjectId: credentials.projectId,
    
    // Claude configuration
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    maxTurns: env.CLAUDE_MAX_TURNS || 10,
    
    // Project context
    projectNamespace: webhookPayload.project.path_with_namespace,
    gitCloneUrl: webhookPayload.project.git_http_url,
    
    // User context
    authorUsername: webhookPayload.user.username,
    userPrompt: extractUserPrompt(webhookPayload),
    
    // Event-specific context
    ...buildEventSpecificContext(webhookPayload)
  }
}
```

## Error Handling

### Error Types

```typescript
enum ContainerError {
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  WORKSPACE_SETUP_FAILED = 'WORKSPACE_SETUP_FAILED',
  CLAUDE_EXECUTION_FAILED = 'CLAUDE_EXECUTION_FAILED',
  GITLAB_API_FAILED = 'GITLAB_API_FAILED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  TIMEOUT = 'TIMEOUT'
}

interface ContainerErrorDetails {
  code: ContainerError
  message: string
  details?: {
    gitlabApiError?: string
    claudeError?: string
    workspaceError?: string
  }
}
```

### Error Response Handling

```typescript
function handleContainerError(error: ContainerErrorDetails, context: ContainerContext): ContainerResponse {
  // Log error for monitoring
  console.error('Container processing error:', error)
  
  // Attempt to post error message to GitLab
  if (context.commentId) {
    postErrorComment(context, error.message)
  }
  
  return {
    success: false,
    requestId: context.requestId,
    processingTime: 0,
    claudeTurnsUsed: 0,
    error: error
  }
}
```

## Health Checks and Monitoring

### Container Health Endpoint

```typescript
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    dependencies: {
      claude: checkClaudeHealth(),
      gitlab: checkGitLabHealth(),
      workspace: checkWorkspaceHealth()
    }
  }
  
  res.json(health)
})
```

### Request Tracking

```typescript
interface RequestMetrics {
  requestId: string
  processingMode: string
  startTime: number
  endTime: number
  success: boolean
  claudeTurnsUsed: number
  gitlabApiCalls: number
  errorCode?: string
}

function trackRequest(metrics: RequestMetrics): void {
  console.log('REQUEST_METRICS', JSON.stringify(metrics))
}
```

## Configuration

### Container Environment Variables

```typescript
interface ContainerConfig {
  PORT: number
  NODE_ENV: string
  MAX_CONCURRENT_REQUESTS: number
  REQUEST_TIMEOUT: number
  WORKSPACE_TIMEOUT: number
  CLAUDE_MAX_TURNS: number
  GITLAB_API_TIMEOUT: number
}
```

This communication protocol provides:
- **Structured request/response format** for reliable communication
- **Multiple processing modes** for different GitLab events
- **Comprehensive error handling** with detailed error information
- **Health checks and monitoring** for operational visibility
- **Flexible configuration** through environment variables
- **Robust workspace management** for code operations