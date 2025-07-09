# Deployment Checklist for GitLab Demo

## Pre-Deployment Checklist

### ✅ Code Changes Completed
- [x] GitLabAppConfigDO added to wrangler.jsonc bindings
- [x] GitLabAppConfigDO migration added (v3)
- [x] All GitLab webhook handlers implemented
- [x] Container GitLab integration complete

### 🔧 Build Requirements
- [ ] Node.js 18+ installed
- [ ] Cloudflare account with Workers enabled
- [ ] Docker installed (for local testing only)

### 📝 Required Credentials
- [ ] **Anthropic API Key** - For Claude Code access
- [ ] **GitLab Personal Access Token** - With api, read_repository, write_repository scopes
- [ ] **GitLab Project ID** - From your test project
- [ ] **Webhook Secret** - Generate a secure random string

## Deployment Steps

### 1. Install Dependencies
```bash
# Root directory
npm install

# Container directory (for local testing)
cd container_src
npm install
cd ..
```

### 2. Generate TypeScript Types
```bash
npm run cf-typegen
```

### 3. Deploy to Cloudflare
```bash
npm run deploy
```

Expected output:
- Worker URL: `https://claude-code-containers.YOUR-SUBDOMAIN.workers.dev`
- Container image built and deployed
- Durable Objects created

### 4. Post-Deployment Configuration

#### Configure Claude API
1. Visit: `https://YOUR-WORKER-URL/claude-setup`
2. Enter Anthropic API key
3. Save configuration

#### Configure GitLab
1. Visit: `https://YOUR-WORKER-URL/gitlab-setup`
2. Enter:
   - GitLab URL (e.g., https://gitlab.com)
   - Project ID
   - Personal Access Token
   - Webhook Secret
3. Save configuration

#### Set Up GitLab Webhook
1. In GitLab project: Settings → Webhooks
2. Add webhook:
   - URL: `https://YOUR-WORKER-URL/webhooks/gitlab`
   - Secret Token: Your webhook secret
   - Events: Issues, Comments, Merge Requests

## Verification Checklist

### 🔍 Endpoint Checks
- [ ] `/` - Returns welcome message
- [ ] `/claude-setup` - Shows Claude configuration page
- [ ] `/gitlab-setup` - Shows GitLab configuration page
- [ ] `/webhooks/gitlab` - Ready to receive webhooks (returns 405 for GET)

### 🧪 Functionality Tests
- [ ] Create test issue → Claude auto-responds
- [ ] Add @duo-agent comment → Claude responds in thread
- [ ] Create MR with @duo-agent → Claude analyzes MR

### 📊 Monitoring
```bash
# Watch real-time logs
npx wrangler tail

# Check for errors
npx wrangler tail --format json | grep ERROR
```

## Common Issues & Solutions

### Issue: Webhook not triggering
- Check webhook secret matches exactly
- Verify webhook URL is correct
- Test webhook from GitLab UI
- Check wrangler tail for incoming requests

### Issue: Authentication failures
- Verify Personal Access Token has correct scopes
- Check token hasn't expired
- Ensure Project ID is numeric (not path)

### Issue: Claude not responding
- Check Anthropic API key is valid
- Monitor logs for rate limits
- Verify container is starting properly

### Issue: Container startup failures
- Check Docker build succeeds locally
- Verify all npm dependencies installed
- Check container logs in wrangler tail

## Demo Preparation

### 📋 Pre-Demo Tasks
- [ ] Deploy and configure 24 hours before demo
- [ ] Test all scenarios multiple times
- [ ] Create backup GitLab project
- [ ] Prepare example issues/MRs
- [ ] Test on demo network/laptop

### 🎯 Demo Scenarios Ready
- [ ] Issue auto-processing example
- [ ] Comment @duo-agent example  
- [ ] MR description @duo-agent example
- [ ] Error handling example (optional)

### 🛠️ Demo Tools
- [ ] Terminal ready with `npx wrangler tail`
- [ ] GitLab project open in browser
- [ ] Backup slides/screenshots prepared
- [ ] Network hotspot as backup

## Quick Commands Reference

```bash
# Deploy
npm run deploy

# Watch logs
npx wrangler tail

# Local development
npm run dev

# Type generation (after wrangler.jsonc changes)
npm run cf-typegen
```

## Support Resources

- **Cloudflare Workers Docs**: https://developers.cloudflare.com/workers/
- **GitLab Webhooks Docs**: https://docs.gitlab.com/ee/user/project/integrations/webhooks.html
- **Project README**: Check main README.md for detailed setup

---

✅ **Ready for Demo** when all checkboxes are marked!