# GitLab Worker Foundation Implementation Notes

## Feature Overview
Implementation of Phase 2.1 - Worker Layer Foundation for GitLab integration.

## Understanding Current Architecture

### GitHub Webhook Pattern
- HMAC-SHA256 signature verification using `x-hub-signature-256` header
- Event routing based on `x-github-event` header
- Durable Object storage for encrypted credentials
- Event handlers: installation, installation_repositories, issues

### Key Differences for GitLab
- GitLab uses direct token comparison (not HMAC) via `X-Gitlab-Token` header
- Event types: issues, note (comments), merge_request
- Personal Access Tokens instead of App-based authentication
- Different webhook payload structure

## Implementation Tasks

### 1. GitLab Webhook Handler
- Create `src/handlers/gitlab_webhook.ts`
- Implement GitLab token verification (direct comparison)
- Event routing for: issues, note, merge_request
- Follow existing logging and error handling patterns

### 2. GitLab Setup Handler
- Create `src/handlers/gitlab_setup.ts`
- Web interface for Personal Access Token configuration
- Token validation with GitLab API
- Encrypted storage in GitLabAppConfigDO

### 3. GitLabAppConfigDO
- New Durable Object class for GitLab credentials
- SQLite tables for GitLab config (token, project_id, webhook_secret)
- Encrypted storage following existing pattern

## Test-Driven Development Plan

### Red Phase Tests
1. GitLab webhook handler should exist and handle POST requests
2. GitLab webhook signature verification should validate tokens
3. Event routing should route to correct handlers based on `object_kind`
4. GitLab setup handler should provide configuration interface
5. GitLabAppConfigDO should store and retrieve credentials securely

### Green Phase Implementation
- Minimal working implementation for each test
- Follow existing patterns from GitHub handlers
- Use same encryption/logging utilities

### Refactor Phase
- Extract common webhook patterns
- Improve error handling
- Optimize credential storage

## Notes During Implementation
- GitLab webhook events use `object_kind` field instead of event type header
- Need to add new routes to main index.ts handler
- Reference implementation at `/Users/ben/code/gitlab-claude` for patterns