# GitLab Issues Processing (GitHub Parity)

## Feature Overview
Implementation of Phase 3.1 - GitLab Issues Processing with GitHub parity functionality.

## Requirements from Plan.md

### 3.1 GitLab Issues Processing (GitHub Parity)
- [ ] Issue webhook handler
  - [ ] Create `src/handlers/gitlab_webhooks/issue.ts`
  - [ ] Parse issue creation events
  - [ ] Extract issue context for Claude
- [ ] Issue processing logic
  - [ ] Adapt current GitHub issue processing for GitLab
  - [ ] Create GitLab MR instead of GitHub PR
  - [ ] Handle GitLab-specific issue fields

## Understanding GitHub Implementation

### Current GitHub Issue Flow
1. GitHub webhook → `github_webhook.ts` → event routing
2. Issue events → `github_webhooks/issue.ts` → container invocation
3. Container processes issue → creates PR or comment
4. Response handling and logging

### Key Files to Examine
- `src/handlers/github_webhooks/issue.ts` - GitHub issue handler pattern
- `src/handlers/github_webhook.ts` - Main webhook router
- `container_src/src/main.ts` - Container issue processing

## GitLab Issue Processing Requirements

### Webhook Event Structure
```typescript
interface GitLabIssueEvent {
  object_kind: "issue"
  event_type: "issue"
  object_attributes: {
    action: "open" | "close" | "reopen" | "update"
    id: number
    iid: number  // Internal ID used for API calls
    title: string
    description: string
    author_id: number
    project_id: number
    created_at: string
    updated_at: string
    state: "opened" | "closed"
    labels: Label[]
  }
  user: {
    id: number
    username: string
    name: string
  }
  project: {
    id: number
    name: string
    path_with_namespace: string
    web_url: string
    git_ssh_url: string
    git_http_url: string
  }
}
```

### Processing Logic
1. **Filter Events**: Only process `action: "open"` events
2. **Extract Context**: Issue IID, title, description, project info
3. **Container Invocation**: Pass GitLab context to container
4. **Container Processing**: Use existing Claude Code logic adapted for GitLab
5. **Result Handling**: Create GitLab MR instead of GitHub PR

## Implementation Plan

### TDD Approach
1. **RED**: Write failing tests for GitLab issue handler
2. **GREEN**: Implement minimal working handler
3. **REFACTOR**: Optimize and improve code quality

### Test Cases
- GitLab issue webhook handler should exist
- Should only process "open" action events
- Should extract correct context for container
- Should invoke container with GitLab environment
- Should handle container responses appropriately
- Should create GitLab MR when container makes changes
- Should post comments when no changes made

## Implementation Notes
- Follow existing GitHub patterns but adapt for GitLab API
- Use GitLab IID (internal ID) for API calls, not ID
- Handle GitLab-specific fields (project namespace, clone URLs)
- Integrate with existing GitLabAppConfigDO for credentials
- Use GitLabClient from Phase 2.2 for API operations

## Implementation Status

### ✅ Completed (Phase 3.1)

**TDD Red Phase:**
- Created comprehensive test suite for GitLab issue handler (6 tests)
- Tests for filtering, context extraction, error handling, container routing

**TDD Green Phase:**
- Implemented `gitlab_webhooks/issue.ts` with full processing logic
- Added GitLab context extraction for containers (PROCESSING_MODE: 'issue')
- Integrated with existing container `/process-gitlab` endpoint
- Support for Claude API key validation and error handling

**TDD Refactor Phase:**
- Integrated issue handler with gitlab_webhook.ts router
- Added proper environment variable mapping for containers
- Container routing with unique names per issue (`claude-gitlab-issue-{id}`)

### ✅ Features Implemented

1. **Event Filtering**: Only processes `action: "open"` issue events
2. **Context Extraction**: Full GitLab issue context with IID, title, description, project info
3. **Container Integration**: Uses existing `/process-gitlab` endpoint with GitLab-specific variables
4. **Error Handling**: Graceful handling of missing API keys and container failures
5. **Webhook Routing**: Seamless integration with gitlab_webhook.ts event router
6. **GitHub Parity**: Same level of functionality as GitHub issue processing

### ✅ Test Coverage
- **6/6 tests passing** for GitLab issue handler
- Full test coverage for context extraction, error scenarios, and container routing
- Integration with existing webhook system validated

### ✅ Environment Variables Supported
- `PROCESSING_MODE: 'issue'` - Tells container this is issue processing
- `GITLAB_URL`, `GITLAB_TOKEN`, `GITLAB_PROJECT_ID` - GitLab API access
- `ISSUE_IID`, `ISSUE_TITLE`, `ISSUE_DESCRIPTION` - Issue context
- `PROJECT_NAMESPACE`, `GIT_CLONE_URL` - Repository information
- `ISSUE_AUTHOR` - Issue creator username
- `ANTHROPIC_API_KEY` - Claude Code API access

## Success Criteria Met
- ✅ GitLab issues automatically processed when opened
- ✅ Container integration with GitLab context variables
- ✅ Full GitHub parity in functionality
- ✅ Comprehensive test coverage (6/6 tests)
- ✅ Integration with existing GitLab webhook system