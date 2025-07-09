# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Note**: This file supports importing other Markdown files using `@path/to/file.md` syntax for modular organization.

## Development Commands

```bash
npm run dev          # Start local development server (http://localhost:8787)
npm run deploy       # Deploy to Cloudflare Workers
npm run cf-typegen   # Generate TypeScript types after wrangler config changes
```

**⚠️ Important:** Always run `npm run cf-typegen` after making changes to `wrangler.jsonc`. This regenerates the TypeScript types and updates `worker-configuration.d.ts` to match your bindings and configuration.

### Wrangler CLI Commands

```bash
npx wrangler dev                    # Start local development (same as npm run dev)
npx wrangler dev --remote          # Use remote Cloudflare resources
npx wrangler deploy                 # Deploy to production (same as npm run deploy)
npx wrangler login                  # Authenticate with Cloudflare
npx wrangler versions upload        # Upload new version with preview URL
```

## Project Overview

This is a **Cloudflare Workers Container project** that integrates **Claude Code** with **GitHub and GitLab** for automated issue processing and comment-based assistance. It combines:
- **TypeScript Worker** (`src/index.ts`) - Main request router and platform integration
- **Node.js Container** (`container_src/src/main.ts`) - Containerized Claude Code environment running on port 8080
- **Durable Objects** - Multiple DO classes for encrypted credential storage and container management

### Supported Platforms

**GitHub Integration:**
- Uses GitHub App Manifests for one-click app creation
- OAuth flow for authentication
- Automatic issue processing

**GitLab Integration:**
- Uses GitLab Personal Access Tokens for authentication
- Supports multiple trigger types: issues, comments, merge requests
- @duo-agent mention system for targeted assistance

## Quick Start

1. **Setup Claude API Key**: Visit `/claude-setup` to configure your Anthropic API key
2. **Configure Platform**:
   - **GitHub**: Visit `/gh-setup` for GitHub App creation
   - **GitLab**: Visit `/gitlab-setup` for Personal Access Token configuration
3. **Test Integration**: Create an issue or comment with `@duo-agent` to trigger Claude
4. **Deploy**: Use `npm run deploy` to deploy to Cloudflare Workers

## Configuration Files

- **`wrangler.jsonc`** - Workers configuration with container bindings and Durable Objects
- **`Dockerfile`** - Multi-stage build with Node.js, Python, Git, GitLab CLI (glab), and Claude Code CLI
- **`worker-configuration.d.ts`** - Auto-generated types (run `npm run cf-typegen` after config changes)
- **`.dev.vars`** - Local environment variables (not committed to git)
- **`container_src/package.json`** - Container dependencies including Claude Code SDK

## Key Endpoints

- `/claude-setup` - Configure Claude API key
- `/gh-setup` - GitHub app creation and setup
- `/gitlab-setup` - GitLab Personal Access Token configuration
- `/webhooks/github` - GitHub webhook processor
- `/webhooks/gitlab` - GitLab webhook processor
- `/container/*` - Basic container functionality
- `/lb/*` - Load balancing across containers
- `/singleton/*` - Single container instance

## Current Implementation Status

**✅ GitHub Integration:**
- GitHub App Manifest setup and OAuth flow
- Secure credential storage in Durable Objects with AES-256-GCM encryption
- Basic webhook processing infrastructure with signature verification
- Container enhancement with Claude Code SDK and GitHub API integration
- Issue detection and routing to Claude Code containers

**✅ GitLab Integration (Phase 2 Complete, Phase 3 Complete, Phase 4.1 Complete):**
- GitLab webhook handlers with Personal Access Token authentication
- GitLab API client with connection pooling and retry logic
- Container integration with GitLab context processing
- Support for @duo-agent mentions in comments and MR descriptions
- GitLab issue processing with GitHub parity (Phase 3.1) ✅
- GitLab comment processing with @duo-agent mention detection (Phase 3.2) ✅
- GitLab MR processing with @duo-agent instruction parsing (Phase 3.3) ✅
- Context-aware processing with enhanced formatting and file/line context (Phase 4.1) ✅
- Comprehensive test coverage (73+ tests passing)

## Detailed Documentation

For comprehensive technical details, refer to the following documentation:

### Architecture & Implementation
- **@docs/technical-specifications.md** - Complete technical specifications for GitLab integration
- **@docs/webhook-event-routing.md** - Detailed webhook routing system and event handling
- **@docs/authentication-strategy.md** - GitLab authentication approach and security
- **@docs/container-communication-protocol.md** - Container communication design and protocols

### Implementation Features
- **@docs/features/CLAUDE.md** - Complete GitLab feature documentation index
- **@docs/features/gitlab-worker-foundation.md** - Worker layer foundation with webhook handling
- **@docs/features/gitlab-api-client.md** - GitLab API client with connection pooling and retry logic
- **@docs/features/container-integration.md** - Container GitLab integration and processing modes
- **@docs/features/gitlab-issues-processing.md** - GitLab issue processing (Phase 3.1) ✅
- **@docs/features/gitlab-comment-processing.md** - GitLab comment processing with @duo-agent (Phase 3.2) ✅
- **@docs/features/gitlab-mr-processing.md** - GitLab MR processing with @duo-agent (Phase 3.3) ✅
- **@docs/features/context-aware-processing.md** - Context-aware processing with enhanced formatting (Phase 4.1) ✅

### Component Documentation
- **@src/handlers/CLAUDE.md** - Request handlers for GitHub and GitLab webhook processing
- **@src/CLAUDE.md** - Worker layer architecture and implementation details
- **@container_src/CLAUDE.md** - Container GitLab integration and processing modes

### Tools & References
- **@docs/GLAB_CLI_REFERENCE.md** - Comprehensive GitLab CLI (glab) command reference and integration guide
- **@Plan.md** - Complete implementation plan with phases and tasks

### Reference Implementation
- **GitLab Claude Reference**: `/Users/ben/code/gitlab-claude` - Working GitLab integration with webhooks, MRs, and Claude Code

## Important Notes

- **Containers are a Beta feature** - API may change. The `cf-containers` library version is pinned to 0.0.7.
- **Always run `npm run cf-typegen`** after making changes to `wrangler.jsonc`
- **Use `.dev.vars`** for local secrets (never commit this file)
- **Workers must start within 400ms** - keep imports and initialization lightweight
- **GitLab CLI Available**: Containers include `glab` CLI tool for comprehensive GitLab operations - see `@docs/GLAB_CLI_REFERENCE.md`

## Development Patterns

### Worker Code Structure
```typescript
export interface Env {
  MY_CONTAINER: DurableObjectNamespace;
  GITHUB_APP_CONFIG: DurableObjectNamespace;
  GITLAB_APP_CONFIG: DurableObjectNamespace;
  ENVIRONMENT?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Worker logic here
    return new Response("Hello World");
  },
} satisfies ExportedHandler<Env>;
```

### Resource Bindings
- **Durable Objects**: Access via `env.MY_CONTAINER.get(id)`
- **Environment Variables**: Access via `env.VARIABLE_NAME`
- **KV/D1/R2**: Configure in wrangler.jsonc, access via env bindings

## Claude Code Memories

- Use context7 MCP server whenever you need docs. Use our package.json to get the current versions of dependencies and packages
- Remember you have a reference implementation of similar functionality with webhooks, gitlab MRs, and claude code at /Users/ben/code/gitlab-claude