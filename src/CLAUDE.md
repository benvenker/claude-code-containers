# Worker Source Code (src/)

This directory contains the Cloudflare Worker source code that handles the main application logic.

## Current GitHub-Focused Architecture

### Core Components

1. **index.ts** - Main entry point with two classes:
   - `GitHubAppConfigDO` - Durable Object for encrypted credential storage (GitHub apps, Claude API keys)
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

**Security Features:**
- HMAC-SHA256 webhook signature verification
- AES-256-GCM encryption for stored credentials
- Secure token generation and caching

## GitLab Adaptation Requirements

To adapt this for GitLab with "@duo-agent" comment triggers:

### Changes Needed:

1. **GitLab API Integration** - Replace GitHub API calls with GitLab API
2. **Comment Parsing** - Detect "@duo-agent" mentions in MR/issue comments
3. **Webhook Structure** - Adapt to GitLab webhook format and events
4. **Authentication** - Use GitLab access tokens instead of GitHub app tokens
5. **Repository Handling** - Adapt git clone URLs for GitLab

### Key Files to Modify:
- `github_webhook.ts` → `gitlab_webhook.ts` 
- `github_webhooks/issue.ts` → `gitlab_webhooks/comment.ts`
- `github_client.ts` → `gitlab_client.ts`
- Update container logic to handle GitLab APIs

### GitLab-Specific Features:
- Parse "@duo-agent [prompt]" syntax from comments
- Handle GitLab MR comment events
- Create GitLab MR comments with Claude's response
- Support GitLab project access tokens