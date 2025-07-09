# Request Handlers (src/handlers/)

This directory contains all request handlers for the Cloudflare Worker, supporting both GitHub and GitLab integrations.

## GitHub Handlers

### Core GitHub Files
- **`github_webhook.ts`** - Main GitHub webhook processor with HMAC signature verification
- **`github_setup.ts`** - GitHub App Manifest creation and OAuth flow
- **`github_status.ts`** - Status endpoint for GitHub configuration validation
- **`oauth_callback.ts`** - OAuth callback handler for GitHub app installation

### GitHub Webhook Events (github_webhooks/)
- **`issue.ts`** - GitHub issue event handler that triggers Claude Code containers
- **`installation.ts`** - GitHub app installation events
- **`installation_change.ts`** - Repository permission changes
- **`index.ts`** - Event router for GitHub webhook events

## GitLab Handlers (Phase 2.1 Complete)

### Core GitLab Files
- **`gitlab_webhook.ts`** - Main GitLab webhook processor with token verification
- **`gitlab_setup.ts`** - GitLab Personal Access Token configuration interface

### GitLab Webhook Events (gitlab_webhooks/)
- **`issue.ts`** - GitLab issue event handler that triggers Claude Code containers (Phase 3.1 ✅)
- **`note.ts`** - GitLab comment processing for @duo-agent mentions (Phase 3.2 ✅)
- **`merge_request.ts`** - GitLab MR processing for @duo-agent instructions (Phase 3.3 🔄)

### GitLab Features Implemented

**gitlab_webhook.ts:**
- Event routing based on `object_kind` (issue/note/merge_request)
- GitLab webhook token verification (X-Gitlab-Token header)
- @duo-agent mention detection with code block filtering
- Bot and system note filtering
- Integration with GitLabAppConfigDO for credential retrieval

**gitlab_setup.ts:**
- Web interface for Personal Access Token configuration
- Token validation via GitLab API (`/api/v4/user` endpoint)
- Project access verification
- Multi-route handling: `/gitlab-setup`, `/configure`, `/validate`, `/status`

### Event Processing Logic

**Issue Events:**
```typescript
// object_kind: "issue", action: "open"
// Auto-process new GitLab issues (GitHub parity)
```

**Note Events (Comments):**
```typescript
// object_kind: "note", noteable_type: "Issue" | "MergeRequest"
// Parse @duo-agent mentions from comment body
// Filter out system notes and bot comments
```

**Merge Request Events:**
```typescript
// object_kind: "merge_request", action: "open"
// Parse @duo-agent instructions from MR description
```

### Authentication Strategy

**GitLab Personal Access Tokens:**
- Stored encrypted in GitLabAppConfigDO using AES-256-GCM
- Required scopes: `api`, `read_repository`, `write_repository`
- Token validation via GitLab API calls
- Support for project, personal, and group access tokens

**Webhook Security:**
- Direct token comparison (not HMAC like GitHub)
- Timing-safe string comparison to prevent timing attacks
- Configurable webhook secrets per project

## Test Coverage

### GitHub Tests
- Full test coverage for GitHub webhook processing
- OAuth flow testing
- Signature verification testing

### GitLab Tests (61 tests total)
- **gitlab_webhook.test.ts** (15 tests) - Event routing and authentication
- **gitlab_setup.test.ts** (12 tests) - Setup interface and token validation
- **gitlab_webhooks/issue.test.ts** (6 tests) - GitLab issue processing (Phase 3.1)
- **gitlab_webhooks/note.test.ts** (11 tests) - GitLab comment processing (Phase 3.2)
- **container integration tests** (17 tests) - GitLab API client and processing

## Usage Patterns

### GitHub Workflow
1. Install GitHub App via `/gh-setup`
2. GitHub sends webhook to `/webhooks/github`
3. Worker processes issue events automatically

### GitLab Workflow
1. Configure token via `/gitlab-setup`
2. Set up GitLab webhook pointing to `/webhooks/gitlab`
3. Use @duo-agent mentions in comments or MR descriptions

## Error Handling

**GitHub:**
- HMAC signature validation failures → 401 Unauthorized
- Missing installation tokens → 403 Forbidden
- Invalid webhook payloads → 400 Bad Request

**GitLab:**
- Invalid webhook tokens → 401 Unauthorized
- Missing @duo-agent mentions → 200 OK (ignored)
- Bot/system comments → 200 OK (filtered)
- Unsupported event types → 200 OK (acknowledged but ignored)

## Development Notes

- All handlers follow consistent error response patterns
- Comprehensive logging for debugging and monitoring
- Modular design allows easy addition of new platforms
- Type-safe implementations using TypeScript interfaces