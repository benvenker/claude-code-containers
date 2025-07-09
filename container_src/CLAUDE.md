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

## GitLab Adaptation Requirements

### Changes Needed:

1. **GitLab API Client** - Replace GitHub client with GitLab API
2. **Comment Processing** - Parse "@duo-agent" mentions and extract prompts
3. **Workspace Management** - Update git clone URLs for GitLab
4. **Response Handling** - Post responses to GitLab MR/issue comments

### Key Modifications:

**main.ts:**
- Replace `processIssue()` with `processComment()` 
- Update prompt preparation for comment context
- Handle GitLab MR/issue comment responses
- Adapt git operations for GitLab repositories

**gitlab_client.ts (new):**
- GitLab API authentication
- Comment creation/replies
- Project/repository operations
- MR comment handling

**Environment Variables:**
- `GITLAB_TOKEN` - GitLab access token
- `COMMENT_ID` - ID of the comment with "@duo-agent"
- `COMMENT_BODY` - Full comment text to parse
- `MR_IID` - Merge request internal ID
- `PROJECT_ID` - GitLab project ID

### GitLab-Specific Features:
- Parse "@duo-agent [prompt]" from comment body
- Support GitLab project namespaces
- Handle GitLab webhook authentication
- Create threaded comment replies