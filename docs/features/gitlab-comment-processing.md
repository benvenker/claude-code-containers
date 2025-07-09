# GitLab Comment Processing (@duo-agent)

## Feature Overview
Implementation of Phase 3.2 - GitLab Comment Processing with @duo-agent mention detection and response handling.

## Requirements from Plan.md

### 3.2 Comment Processing (@duo-agent)
- [ ] Comment detection system
  - [ ] Create `src/handlers/gitlab_webhooks/note.ts`
  - [ ] Implement @duo-agent mention parsing
  - [ ] Filter issue vs MR comments
  - [ ] Bot comment prevention logic
- [ ] Comment processing logic
  - [ ] Parse user prompts from @duo-agent mentions
  - [ ] Execute Claude Code with user-specified prompts
  - [ ] Handle threaded comment responses

## Understanding GitLab Note Events

### GitLab Note Webhook Structure
Based on technical specifications, GitLab note events have:
- `object_kind: "note"`
- `object_attributes.noteable_type: "Issue" | "MergeRequest"`
- `object_attributes.note`: The comment text containing @duo-agent mentions
- `object_attributes.system: false` (filter out system notes)
- `user.bot: false` (filter out bot comments)

### Processing Requirements
1. **@duo-agent Detection**: Parse "@duo-agent [prompt]" from comment text
2. **Code Block Filtering**: Remove code blocks to avoid false positives
3. **Event Filtering**: Only process human comments, not system/bot comments
4. **Context Extraction**: Extract issue/MR context for Claude processing
5. **Response Handling**: Reply to discussion threads appropriately

## Current GitLab Webhook Integration

### Existing Components
- `src/handlers/gitlab_webhook.ts` - Main webhook router with note event routing
- `src/handlers/gitlab_webhooks/issue.ts` - Issue processing (Phase 3.1 complete)
- Container `/process-gitlab` endpoint - Handles GitLab context processing

### Integration Points
- GitLab webhook router already handles note events (currently returns placeholder)
- Container already supports `PROCESSING_MODE: 'issue_comment'` and `'mr_comment'`
- GitLab API client has methods for comment creation and discussion handling

## Implementation Plan

### TDD Approach
1. **RED**: Write failing tests for GitLab note handler
2. **GREEN**: Implement minimal working handler
3. **REFACTOR**: Optimize and improve code quality

### Test Cases to Implement
- Note handler should exist and be a function
- Should detect @duo-agent mentions in comment text
- Should filter out system notes and bot comments
- Should differentiate between issue and MR comments
- Should extract user prompt from @duo-agent mentions
- Should handle comments without @duo-agent mentions (ignore)
- Should remove code blocks before @duo-agent detection
- Should route to container with correct processing mode

## Environment Variables for Container
- `PROCESSING_MODE: 'issue_comment'` or `'mr_comment'`
- `USER_PROMPT`: Extracted prompt from @duo-agent mention
- `COMMENT_ID`: Note ID for reply threading
- `DISCUSSION_ID`: Discussion thread ID
- `COMMENT_AUTHOR`: Username of comment author
- Issue context: `ISSUE_IID`, `ISSUE_TITLE`, `ISSUE_DESCRIPTION`
- MR context: `MR_IID`, `MR_TITLE`, `MR_DESCRIPTION`, `SOURCE_BRANCH`, `TARGET_BRANCH`

## Implementation Notes
- Follow existing patterns from `gitlab_webhooks/issue.ts`
- Use same container routing mechanism
- Implement @duo-agent parsing with code block filtering
- Handle both issue and MR comment contexts
- Ensure proper error handling and logging

## Implementation Status

### 🔄 TODO (Phase 3.2)
- **Comment Detection**: @duo-agent mention parsing with code block filtering
- **Event Filtering**: System note and bot comment filtering
- **Context Processing**: Issue vs MR comment differentiation
- **Container Integration**: Route to existing `/process-gitlab` endpoint
- **Response Handling**: Thread comment replies

## Success Criteria
- ✅ All tests passing for GitLab note handler
- ✅ @duo-agent mentions trigger Claude processing
- ✅ System notes and bot comments are filtered out
- ✅ Issue and MR comments are handled appropriately
- ✅ Container receives correct context variables
- ✅ Integration with existing GitLab webhook system