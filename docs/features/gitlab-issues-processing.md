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

## Success Criteria
- GitLab issues automatically processed when opened
- Container creates appropriate GitLab MRs or comments
- Full GitHub parity in functionality
- All tests passing
- Integration with existing GitLab webhook system