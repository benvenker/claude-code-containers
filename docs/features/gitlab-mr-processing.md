# GitLab MR Processing (Description Parsing)

## Feature Overview
Implementation of Phase 3.3 - GitLab Merge Request Processing with @duo-agent instruction parsing from MR descriptions.

## Requirements from Plan.md

### 3.3 MR Processing (Description Parsing)
- [ ] MR webhook handler
  - [ ] Create `src/handlers/gitlab_webhooks/merge_request.ts`
  - [ ] Parse MR creation events
  - [ ] Extract MR description instructions
- [ ] MR processing logic
  - [ ] Parse @duo-agent instructions from MR descriptions
  - [ ] Execute Claude Code on MR context
  - [ ] Handle MR updates and commits

## Understanding GitLab MR Events

### GitLab MR Webhook Structure
Based on technical specifications, GitLab merge request events have:
- `object_kind: "merge_request"`
- `object_attributes.action: "open" | "close" | "reopen" | "update" | "merge"`
- `object_attributes.description`: The MR description containing @duo-agent instructions
- `object_attributes.source_branch`: Feature branch being merged
- `object_attributes.target_branch`: Target branch (usually main/master)

### Processing Requirements
1. **@duo-agent Detection**: Parse "@duo-agent [instructions]" from MR description
2. **Code Block Filtering**: Remove code blocks to avoid false positives (same as comment processing)
3. **Event Filtering**: Only process "open" action events, filter out bot MRs
4. **Context Extraction**: Extract MR context for Claude processing
5. **Workspace Setup**: Work on source branch with existing code changes

## Current GitLab Webhook Integration

### Existing Components
- `src/handlers/gitlab_webhook.ts` - Main webhook router with merge_request event routing
- `src/handlers/gitlab_webhooks/issue.ts` - Issue processing (Phase 3.1 complete)
- `src/handlers/gitlab_webhooks/note.ts` - Comment processing (Phase 3.2 complete)
- Container `/process-gitlab` endpoint - Handles GitLab context processing

### Integration Points
- GitLab webhook router already handles merge_request events (currently returns placeholder)
- Container already supports `PROCESSING_MODE: 'mr_creation'`
- GitLab API client has methods for MR updates and commit handling

## Implementation Plan

### TDD Approach
1. **RED**: Write failing tests for GitLab MR handler
2. **GREEN**: Implement minimal working handler
3. **REFACTOR**: Optimize and improve code quality

### Test Cases to Implement
- MR handler should exist and be a function
- Should detect @duo-agent mentions in MR description
- Should filter out MRs without @duo-agent mentions (ignore)
- Should only process "open" action events
- Should filter out bot-created MRs
- Should extract user instructions from @duo-agent mentions
- Should remove code blocks before @duo-agent detection
- Should route to container with correct processing mode

## Environment Variables for Container
- `PROCESSING_MODE: 'mr_creation'`
- `USER_PROMPT`: Extracted instructions from @duo-agent mention
- `MR_IID`: MR internal ID
- `MR_TITLE`: MR title
- `MR_DESCRIPTION`: Full MR description
- `SOURCE_BRANCH`: Feature branch name
- `TARGET_BRANCH`: Target branch name
- `MR_AUTHOR`: Username of MR creator
- Project context: `PROJECT_NAMESPACE`, `GIT_CLONE_URL`, authentication

## Key Differences from Comment Processing
1. **Trigger**: MR creation instead of comment creation
2. **Context**: Full MR context instead of comment thread
3. **Workspace**: Work on source branch instead of creating new branch
4. **Output**: Update MR description with progress instead of replying to thread

## Implementation Notes
- Follow existing patterns from `gitlab_webhooks/issue.ts` and `gitlab_webhooks/note.ts`
- Reuse @duo-agent parsing logic from note handler
- Use same container routing mechanism with unique MR-based container names
- Ensure proper error handling and logging
- Handle edge cases like empty descriptions or malformed @duo-agent syntax

## Implementation Status

### 🔄 TODO (Phase 3.3)
- **MR Detection**: @duo-agent instruction parsing from MR descriptions
- **Event Filtering**: "open" action and bot MR filtering
- **Context Processing**: MR context extraction and processing
- **Container Integration**: Route to existing `/process-gitlab` endpoint
- **Response Handling**: Update MR with progress/results

### Test Strategy
- Follow same test pattern as `note.test.ts` and `issue.test.ts`
- Test @duo-agent detection with and without code blocks
- Test various MR action types (open, close, etc.)
- Test bot detection and filtering
- Test container context building and routing

## Success Criteria
- [ ] All tests passing for GitLab MR handler
- [ ] @duo-agent mentions in MR descriptions trigger Claude processing
- [ ] Bot MRs and non-"open" actions are filtered out
- [ ] Container receives correct MR context variables
- [ ] Integration with existing GitLab webhook system
- [ ] MR updates with Claude progress/results