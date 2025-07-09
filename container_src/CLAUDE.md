# Container Source Code (container_src/)

This directory contains the containerized Claude Code execution environment that runs in Cloudflare Workers containers.

## Current GitHub Implementation

### Core Components

1. **main.ts** - Main container server logic:
   - HTTP server on port 8080
   - Issue processing with Claude Code SDK
   - Git workspace management
   - GitHub API integration for PRs/comments

2. **github_client.ts** - GitHub API client wrapper:
   - Authenticated GitHub API calls
   - Repository operations
   - Issue/PR comment creation
   - Pull request management

### Key Functions

**Issue Processing Flow:**
1. `processIssue()` - Main orchestration function
2. `setupWorkspace()` - Git clone with authentication
3. `prepareClaudePrompt()` - Format issue context for Claude
4. `detectGitChanges()` - Check for code modifications
5. `createFeatureBranchCommitAndPush()` - Git workflow management

**Claude Code Integration:**
- Uses `@anthropic-ai/claude-code` SDK
- Runs in isolated workspace per issue
- Generates pull requests or comments based on changes
- Handles both code modifications and analysis-only responses

## GitLab Integration Implementation (Phase 2.3 Complete, Phase 3 Complete, Phase 4.1 Complete)

### ✅ Completed Features:

1. **GitLab API Client** - `gitlab_client.ts` with connection pooling and retry logic
2. **GitLab Context Processing** - Support for issue, comment, and MR processing modes
3. **Environment Variable Handling** - Complete GitLab context extraction
4. **Context Formatters** - Issue, comment, and MR context preparation for Claude
5. **GitLab Issue Processing** - Full integration with issue webhook events (Phase 3.1) ✅
6. **GitLab Comment Processing** - @duo-agent mention detection and container processing (Phase 3.2) ✅
7. **GitLab MR Processing** - @duo-agent instruction parsing from MR descriptions (Phase 3.3) ✅
8. **Context-Aware Processing** - Enhanced formatting with file/line context and syntax highlighting (Phase 4.1) ✅

### ✅ Implemented Components:

**main.ts Updates:**
- Added GitLab processing modes: `issue`, `issue_comment`, `mr_comment`, `mr_creation`
- GitLab-specific environment variable handling
- Integration with GitLab API client
- Context formatting for different GitLab events

**gitlab_client.ts (Complete):**
- Full GitLab API client with TypeScript types
- Connection pooling using HTTP/HTTPS agents
- Exponential backoff retry logic for resilience
- Methods for MRs, comments, discussions, diffs
- Comprehensive error handling and logging

**GitLab Context Processing:**
- Issue context: Title, description, labels, assignees
- Comment context: User prompt extraction, discussion threading
- MR context: Source/target branches, diff information, line-specific comments
- Project context: Namespace, clone URLs, authentication
- Context-aware processing: File/line information, syntax highlighting, collapsible sections

### Environment Variables Supported:
- `GITLAB_URL` - GitLab instance URL
- `GITLAB_TOKEN` - Personal Access Token
- `GITLAB_PROJECT_ID` - Project ID for API calls
- `PROCESSING_MODE` - Event type (issue/issue_comment/mr_comment/mr_creation)
- `USER_PROMPT` - Extracted @duo-agent command
- Context-specific variables for issue/MR details
- `CONTEXT_AWARE_PROCESSING` - Flag for enhanced formatting features
- `FILE_PATH`, `LINE_NUMBER` - Code location context for MR comments
- `DISCUSSION_ID` - Thread context for enhanced responses

### GitLab-Specific Features Implemented:
- Parse "@duo-agent [prompt]" from comment body with code block filtering
- Support GitLab project namespaces and clone URLs
- Handle GitLab webhook token authentication
- Create threaded comment replies with discussion IDs
- Line-specific MR comments with file/line context
- Enhanced response formatting with syntax highlighting (25+ languages)
- Context-aware processing with collapsible sections and GitLab URL references
- Discussion thread context integration for better conversation flow