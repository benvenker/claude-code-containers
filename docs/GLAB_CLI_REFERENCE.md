# GitLab CLI (glab) Reference

## Overview
GitLab CLI (`glab`) is available in the Claude Code container environment and provides comprehensive GitLab integration capabilities.

## Authentication
```bash
glab auth login          # Authenticate with GitLab instance
glab auth status         # View authentication status
glab auth logout         # Logout from GitLab instance
```

**Environment Variables:**
- `GITLAB_TOKEN`: Authentication token for API requests (overrides stored credentials)
- `GITLAB_HOST` / `GL_HOST`: GitLab server URL (defaults to https://gitlab.com)

## Core Commands

### Issues
```bash
glab issue list                    # List project issues
glab issue create                  # Create an issue
glab issue view <issue-id>         # View issue details
glab issue note <issue-id>         # Add comment to issue
glab issue close <issue-id>        # Close an issue
glab issue update <issue-id>       # Update issue
```

### Merge Requests
```bash
glab mr list                       # List merge requests
glab mr create                     # Create new merge request
glab mr view <mr-id>              # View MR details
glab mr note <mr-id>              # Add comment to MR
glab mr merge <mr-id>             # Merge/accept MR
glab mr close <mr-id>             # Close MR
glab mr diff <mr-id>              # View MR changes
glab mr checkout <mr-id>          # Check out MR branch
```

### Repository/Project
```bash
glab repo view                     # View current project
glab repo list                     # List repositories
glab repo create                   # Create new repository
glab repo clone <repo>            # Clone repository
glab repo fork <repo>             # Fork repository
glab repo archive                 # Get repository archive
glab repo contributors            # List repository contributors
glab repo search <query>          # Search for repositories
glab repo transfer                # Transfer repository to new namespace
```

### CI/CD Pipelines & Jobs
```bash
glab ci list                       # List CI/CD pipelines
glab ci status                     # View current pipeline status
glab ci view                       # View pipeline details
glab ci run                        # Create/run new pipeline
glab ci cancel <pipeline-id>       # Cancel running pipeline
glab ci retry <job-id>             # Retry CI/CD job
glab ci trace <job-id>             # Trace job log in real time
glab ci artifact <job-id>          # Download job artifacts
glab ci lint                       # Validate .gitlab-ci.yml
glab ci config                     # Work with CI/CD configuration
glab ci trigger <trigger-token>    # Trigger manual job
```

### Labels & Project Management
```bash
glab label list                    # List project labels
glab label create <name>           # Create new label
glab label delete <name>           # Delete label
```

### Releases
```bash
glab release list                  # List project releases
glab release view <tag>            # View release details
glab release create <tag>          # Create new release
glab release delete <tag>          # Delete release
glab release upload <tag> <file>   # Upload release assets
glab release download <tag>        # Download release assets
```

### Variables & Configuration
```bash
glab variable list                 # List project/group variables
glab variable get <key>            # Get variable value
glab variable set <key> <value>    # Set variable
glab variable delete <key>         # Delete variable
glab variable export               # Export all variables
```

### Tokens & Authentication
```bash
glab token list                    # List access tokens
glab token create                  # Create new token
glab token revoke <token-id>       # Revoke token
glab token rotate <token-id>       # Rotate token
```

### Snippets
```bash
glab snippet create                # Create code snippet
glab snippet view <snippet-id>     # View snippet
```

### User & Events
```bash
glab user events                   # View user activity events
```

### GitLab Duo AI
```bash
glab duo ask "how to revert commit"  # Generate Git commands from natural language
```

### Configuration
```bash
glab config get <key>              # Get configuration value
glab config set <key> <value>      # Set configuration
glab config edit                   # Edit config file
```

### API Access
```bash
glab api <endpoint>                # Make authenticated API calls
glab api projects/:fullpath/issues # Get project issues via API
glab api graphql -f query="..."   # GraphQL queries
```

**API Placeholders:**
- `:branch` - Current branch
- `:fullpath` - Full project path
- `:group` - Group name
- `:id` - Project ID
- `:namespace` - Project namespace
- `:repo` - Repository name
- `:user` - User name

## Useful Flags
- `-R, --repo OWNER/REPO`: Specify repository (works with most commands)
- `--paginate`: Fetch all pages of results
- `-H, --header`: Add HTTP headers
- `-F, --field`: Add parameters to requests
- `--hostname`: Override GitLab hostname

## GitLab Integration Use Cases

### For Claude Code Container
1. **Issue Processing**: Use `glab issue view` to get issue details, `glab issue note` to add comments
2. **MR Processing**: Use `glab mr view` for MR context, `glab mr note` for comments, `glab mr create` for new MRs
3. **Repository Operations**: Use `glab repo view` for project info, `glab api` for custom operations
4. **CI/CD Integration**: Monitor pipelines with `glab ci status`, trigger jobs, download artifacts
5. **Release Management**: Create releases with `glab release create`, upload assets
6. **Project Configuration**: Manage variables with `glab variable set`, labels with `glab label create`
7. **Token Management**: Create and rotate tokens with `glab token create/rotate`
8. **Content Creation**: Generate code snippets with `glab snippet create`
9. **Authentication**: Pre-configure with `GITLAB_TOKEN` and `GITLAB_HOST` environment variables

### Advanced Use Cases
1. **Automated Release Pipeline**: Create releases, upload artifacts, update release notes
2. **CI/CD Monitoring**: Track pipeline status, retry failed jobs, download test artifacts
3. **Project Maintenance**: Manage labels, variables, and project settings
4. **Security Management**: Rotate tokens, audit access, manage deploy keys
5. **Development Workflow**: Use GitLab Duo for command suggestions, manage branches
6. **Content Management**: Create and share code snippets, manage project documentation

### API Examples
```bash
# Get project details
glab api projects/:fullpath

# Get specific issue
glab api projects/:fullpath/issues/123

# Get MR discussions
glab api projects/:fullpath/merge_requests/456/discussions

# Create issue comment
glab api projects/:fullpath/issues/123/notes -f body="Comment text"

# Get project members
glab api projects/:fullpath/members

# Get CI/CD pipelines
glab api projects/:fullpath/pipelines
```

### Practical Examples for Claude Code Integration

```bash
# CI/CD Integration - Monitor and manage pipelines
glab ci status                     # Check current pipeline status
glab ci view 12345                 # View specific pipeline
glab ci trace 67890                # Follow job logs in real-time
glab ci artifact download          # Download build artifacts

# Release Management - Automate releases
glab release create v1.2.3 --notes "Release notes" --assets dist/*
glab release upload v1.2.3 ./binary
glab release view v1.2.3

# Project Configuration - Manage settings
glab variable set DATABASE_URL "postgresql://..."
glab label create "claude-processed" --color "#ff0000"
glab variable export > project-vars.env

# Token Security - Rotate tokens for security
glab token list --type project
glab token rotate <token-id>

# Content Creation - Generate and share code
glab snippet create --title "Fix for issue #123" --filename fix.py
glab duo ask "create a git hook to run tests before commit"

# Advanced Monitoring - Track project activity
glab user events                   # See recent activity
glab api projects/:fullpath/events # Get project-specific events
```

### Environment Setup for Container
```bash
export GITLAB_TOKEN="glpat-xxxxxxxxxxxxxxxxxxxx"
export GITLAB_HOST="https://gitlab.com"
export GL_HOST="https://gitlab.com"
```

## Integration with GitLab Webhook Processing

When processing GitLab webhooks in the container, `glab` can be used to:

1. **Fetch additional context** not in webhook payload
2. **Create responses** (comments, MRs, etc.)
3. **Query project state** (branches, files, etc.)
4. **Perform GitLab operations** on behalf of Claude Code

### Example Container Integration
```typescript
// In container processing
async function processGitLabIssue(issueIid: number, projectPath: string) {
  // Get full issue details
  const issueDetails = await execAsync(`glab api projects/${encodeURIComponent(projectPath)}/issues/${issueIid}`);
  
  // Add comment with Claude response
  await execAsync(`glab issue note ${issueIid} -m "${claudeResponse}"`);
  
  // Create MR if code changes made
  if (hasCodeChanges) {
    await execAsync(`glab mr create --fill --source-branch claude-fix-${issueIid}`);
  }
}
```

## Key Benefits for Claude Code
- **Native GitLab integration** without custom API clients
- **Authenticated operations** using project tokens
- **Rich context access** beyond webhook payloads
- **Standardized GitLab operations** following GitLab CLI patterns
- **Environment variable configuration** matching container setup

This provides a powerful complement to the existing GitLab API client and webhook processing system.