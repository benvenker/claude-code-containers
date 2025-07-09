# Worker Source Code (src/)

This directory contains the Cloudflare Worker source code that handles the main application logic.

## Current GitHub-Focused Architecture

### Core Components

1. **index.ts** - Main entry point with three classes:
   - `GitHubAppConfigDO` - Durable Object for encrypted credential storage (GitHub apps, Claude API keys)
   - `GitLabAppConfigDO` - Durable Object for GitLab multi-project and group-level credential storage
   - `MyContainer` - Extended Container class for containerized Claude Code execution
   - Main request handler with routing logic

2. **Handlers** (src/handlers/):
   - `claude_setup.ts` - Configure Claude API key through web interface
   - `github_setup.ts` - GitHub App Manifest creation and OAuth flow
   - `github_status.ts` - Status endpoint for configuration validation
   - `github_webhook.ts` - Main webhook entry point with signature verification
   - `oauth_callback.ts` - OAuth callback handler for GitHub app setup

3. **GitHub Webhook Processing** (src/handlers/github_webhooks/):
   - `issue.ts` - Issue event handler that triggers Claude Code containers
   - `installation.ts` - GitHub app installation events
   - `installation_change.ts` - Repository permission changes

### Key Architecture Points

**Current Flow:**
1. GitHub webhook → signature verification → event routing
2. Issue events trigger containerized Claude Code analysis
3. Container clones repo, runs Claude Code, creates PRs/comments
4. Credentials stored encrypted in Durable Objects

**Database Schema (SQLite in Durable Objects):**
- `github_app_config` - App credentials, installation details
- `installation_tokens` - Cached GitHub tokens with expiry
- `claude_config` - Encrypted Anthropic API key
- `gitlab_projects` - Multi-project GitLab configurations (Phase 4.2)
- `gitlab_groups` - Group-level GitLab configurations (Phase 4.2)

**Security Features:**
- HMAC-SHA256 webhook signature verification
- AES-256-GCM encryption for stored credentials
- Secure token generation and caching

## GitLab Integration Implementation (Phase 2 Complete, Phase 3 Complete, Phase 4.1 Complete, Phase 4.2 Complete)

### ✅ Completed GitLab Features:

1. **GitLab Webhook Handling** - Complete webhook processing with token verification
2. **GitLab Setup Interface** - Web-based Personal Access Token configuration
3. **GitLab Authentication** - Secure credential storage in GitLabAppConfigDO with multi-project and group-level support
4. **Event Routing** - Support for issue, note, and merge_request events
5. **@duo-agent Detection** - Parse mentions from comments and MR descriptions
6. **GitLab Issue Processing** - Auto-process new GitLab issues (GitHub parity) ✅
7. **GitLab Comment Processing** - @duo-agent mention detection and response handling (Phase 3.2) ✅
8. **GitLab MR Processing** - @duo-agent instruction parsing from MR descriptions (Phase 3.3) ✅
9. **Context-Aware Processing** - Enhanced response formatting with file/line context and syntax highlighting (Phase 4.1) ✅
10. **Multi-Project Support** - Single Worker instance can handle multiple GitLab projects with individual configurations (Phase 4.2) ✅

### ✅ Implemented Files:

**New GitLab Handlers:**
- `gitlab_webhook.ts` - Main webhook processor with token verification
- `gitlab_setup.ts` - Web interface for token configuration and validation
- `gitlab_webhooks/issue.ts` - GitLab issue event handler (Phase 3.1) ✅
- `gitlab_webhooks/note.ts` - GitLab comment processing handler (Phase 3.2) ✅
- `gitlab_webhooks/merge_request.ts` - GitLab MR processing handler (Phase 3.3) ✅
- `gitlab_webhooks/context_aware.ts` - Context-aware processing utilities (Phase 4.1) ✅
- `gitlab_webhooks/note_enhanced.ts` - Enhanced note handler with context-aware features (Phase 4.1) ✅
- GitLabAppConfigDO class in `index.ts` - Encrypted credential storage with multi-project and group-level support

**Event Processing:**
- Issue events: Auto-process new GitLab issues (GitHub parity)
- Note events: Handle @duo-agent mentions in issue/MR comments
- Merge request events: Process @duo-agent instructions from MR descriptions
- Bot detection and system note filtering

**Security Features:**
- GitLab webhook token verification (X-Gitlab-Token header)
- Encrypted credential storage using AES-256-GCM
- Token validation via GitLab API calls
- Project access verification

### GitLab-Specific Features Implemented:
- Parse "@duo-agent [prompt]" syntax with code block filtering
- Handle GitLab webhook event routing (object_kind based)
- Support GitLab Personal Access Tokens with project/group scope
- GitLab project namespace and clone URL handling
- Discussion-threaded comment responses
- Context-aware processing with file/line information and syntax highlighting
- Multi-project support with per-project configuration and webhook secrets
- Group-level support for automatic project discovery within GitLab groups