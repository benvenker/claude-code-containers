# Container Integration Feature

## Overview
Implementing Phase 2.3 of the GitLab integration plan: Update container main logic to support GitLab event processing alongside existing GitHub functionality.

## Requirements from Plan.md
- Modify `container_src/src/main.ts` for GitLab context
- Add GitLab event processing modes
- Update environment variable handling
- Create GitLab context formatters (issue/comment/MR)

## Current State Analysis
- Current container is GitHub-focused with `processIssue()` function
- Uses GitHub API client and creates GitHub PRs
- Processes environment variables like `ISSUE_NUMBER`, `ISSUE_TITLE`, etc.
- Uses `@anthropic-ai/claude-code` SDK for AI processing

## GitLab Adaptation Strategy
1. **Dual Processing Support**: Support both GitHub issues and GitLab events
2. **Processing Mode Detection**: Use environment variables to determine processing type
3. **Context Formatters**: Create specific formatters for GitLab issue/comment/MR contexts
4. **API Client Integration**: Use new GitLabClient alongside existing GitHub client

## Environment Variables for GitLab
Based on container communication protocol:
- `PROCESSING_MODE`: 'issue' | 'issue_comment' | 'mr_comment' | 'mr_creation'
- `GITLAB_URL`: GitLab instance URL
- `GITLAB_TOKEN`: Personal Access Token
- `GITLAB_PROJECT_ID`: Project ID
- `PROJECT_NAMESPACE`: Full project path
- `GIT_CLONE_URL`: GitLab git URL
- `USER_PROMPT`: User's @duo-agent prompt (for comments)
- `ISSUE_IID`, `MR_IID`: GitLab internal IDs
- Comment context: `COMMENT_ID`, `DISCUSSION_ID`
- Code context: `FILE_PATH`, `LINE_NUMBER`

## TDD Approach
1. **RED**: Write failing tests for GitLab processing modes
2. **GREEN**: Implement minimal GitLab support
3. **REFACTOR**: Improve architecture and code quality

## Test Strategy
- Test processing mode detection
- Test GitLab context formatting
- Test environment variable handling
- Test integration with GitLabClient
- Test response formatting for GitLab

## Implementation Notes
- Maintain backward compatibility with GitHub
- Use TypeScript interfaces for strong typing
- Follow existing error handling patterns
- Integrate with existing Claude Code workflow

## Implementation Status

### ✅ TDD Complete - GREEN Phase
- **Feature branch**: Created and tests passing
- **Documentation**: Notes file with strategy and requirements
- **Tests**: 12/12 tests passing for GitLab integration
- **Core functions implemented**:
  - `detectProcessingMode()` - Detects GitLab vs GitHub processing
  - `validateGitLabContext()` - Validates required environment variables
  - `formatGitLabIssueContext()` - Formats GitLab issue prompts for Claude
  - `formatGitLabCommentContext()` - Formats @duo-agent comment prompts
  - `formatGitLabMRContext()` - Formats MR comment prompts
  - `/process-gitlab` endpoint - Basic GitLab request handling

### ✅ TDD Refactor Phase (Complete)
- **Enhanced GitLab processing**: Added processGitLabMode dispatcher
- **GitLab API integration**: GitLabClient integration ready
- **Improved error handling**: Comprehensive validation and error responses
- **Workspace management**: setupGitLabWorkspace with GitLab auth support
- **Optimized architecture**: Clean separation of concerns and reusable helpers
- **Production ready**: All 31 tests passing (12 GitLab + 19 GitLab Client)

### ✅ Backward Compatibility
- All existing GitHub functionality preserved
- GitHub tests still passing
- Dual-mode support (GitHub/GitLab) working