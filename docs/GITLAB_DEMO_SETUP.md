# GitLab Demo Quick Setup Guide

This guide will help you quickly deploy and configure the Claude Code GitLab integration for your demo.

## Prerequisites

- Cloudflare Workers account
- GitLab account with a test project
- Anthropic API key (Claude API access)
- Node.js 18+ installed locally

## 1. Pre-Deployment Setup

### Update TypeScript Types
After the wrangler.jsonc changes, regenerate types:
```bash
npm run cf-typegen
```

### Build Container Image
The deployment will automatically build the Docker container, but you can test locally:
```bash
# From project root
npm install
npm run build
```

## 2. Deploy to Cloudflare Workers

### Deploy the Worker
```bash
npm run deploy
```

This will:
- Build the TypeScript Worker code
- Build the Docker container image
- Deploy to Cloudflare Workers
- Output your deployment URL (e.g., `https://claude-code-containers.YOUR-SUBDOMAIN.workers.dev`)

## 3. Configure Claude API

1. Visit: `https://YOUR-WORKER-URL/claude-setup`
2. Enter your Anthropic API key
3. Click "Save Configuration"

## 4. Configure GitLab Integration

### Step 1: Personal Access Token
1. In GitLab, go to **User Settings > Access Tokens**
2. Create a new token with these scopes:
   - `api` - Full API access
   - `read_repository` - Read repository content
   - `write_repository` - Push commits
3. Set an expiration date (after your demo)
4. Copy the token (starts with `glpat-`)

### Step 2: Configure in Worker
1. Visit: `https://YOUR-WORKER-URL/gitlab-setup`
2. Fill in:
   - **GitLab URL**: `https://gitlab.com` (or your instance URL)
   - **Project ID**: Your GitLab project ID (found in project settings)
   - **Personal Access Token**: The token you created
   - **Webhook Secret**: Generate a random string (e.g., `demo-webhook-secret-2025`)
3. Click "Configure GitLab"

### Step 3: Set Up GitLab Webhook
1. In your GitLab project, go to **Settings > Webhooks**
2. Add a new webhook:
   - **URL**: `https://YOUR-WORKER-URL/webhooks/gitlab`
   - **Secret Token**: Same as webhook secret from Step 2
   - **Trigger Events**:
     - ✅ Issues events
     - ✅ Comments
     - ✅ Merge request events
3. Click "Add webhook"
4. Test the webhook using the "Test" button

## 5. Available Tools in Container

The Claude Code container now includes:
- **GitLab CLI (glab)** - Pre-installed and auto-configured with your GitLab token
- **Git** - For repository operations
- **Python 3** - For scripts and automation
- **Node.js** - For JavaScript/TypeScript execution
- **Claude Code CLI** - For AI-powered code assistance

The GitLab CLI is automatically configured when processing GitLab events, allowing Claude to use commands like:
- `glab issue create` - Create new issues
- `glab mr create` - Create merge requests
- `glab api` - Direct API access
- And more GitLab operations

## 6. Demo Scenarios

### Scenario 1: Auto-Process New Issue
1. Create a new issue in GitLab:
   - Title: "Add user authentication to the app"
   - Description: "We need to implement JWT-based authentication for our REST API"
2. Claude will automatically analyze and respond with suggestions

### Scenario 2: Comment with @duo-agent
1. On any issue, add a comment:
   ```
   @duo-agent Can you help me understand the best practices for JWT token storage?
   ```
2. Claude will respond in the comment thread

### Scenario 3: MR with Instructions
1. Create a new merge request:
   - Title: "Implement error handling"
   - Description:
     ```
     @duo-agent Please review this MR and suggest improvements for error handling.
     Focus on:
     - Proper error types
     - User-friendly error messages
     - Logging best practices
     ```
2. Claude will analyze the MR and provide feedback

## 7. Troubleshooting

### Check Worker Logs
```bash
npx wrangler tail
```

### Common Issues

**Webhook not triggering:**
- Verify webhook secret matches in both GitLab and Worker config
- Check webhook test results in GitLab
- Ensure correct events are selected

**Authentication errors:**
- Verify Personal Access Token has correct scopes
- Check token hasn't expired
- Ensure project ID is correct

**Claude not responding:**
- Verify Anthropic API key is valid
- Check Worker logs for errors
- Ensure @duo-agent is spelled correctly

## 8. Demo Tips

1. **Pre-create some issues** before the demo to avoid waiting
2. **Test all scenarios** beforehand to ensure smooth operation
3. **Have backup examples** ready in case of network issues
4. **Show the logs** (`npx wrangler tail`) to demonstrate real-time processing

## Environment Variables Reference

The Worker uses these environment variables (set via web UI):
- `ANTHROPIC_API_KEY` - Set via `/claude-setup`
- GitLab credentials - Set via `/gitlab-setup` and stored encrypted

No manual environment variable configuration needed!

## Quick Links

- Worker URL: `https://YOUR-WORKER-URL/`
- Claude Setup: `https://YOUR-WORKER-URL/claude-setup`
- GitLab Setup: `https://YOUR-WORKER-URL/gitlab-setup`
- Logs: `npx wrangler tail`