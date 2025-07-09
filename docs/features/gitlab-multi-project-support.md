# GitLab Multi-Project Support

## Feature Overview
Implementation of multi-project support for GitLab integration, allowing a single Worker instance to handle multiple GitLab projects with individual configurations.

## Requirements
- Support multiple GitLab projects in a single Worker deployment
- Each project has its own Personal Access Token and webhook secret
- Automatic project identification from webhook payloads
- Management interface for adding/removing projects

## Implementation Status

### ✅ COMPLETED (Phase 4.2)
- **Database Schema**: Updated to support multiple projects with `gitlab_projects` table
- **API Endpoints**: Project-specific CRUD operations
- **Webhook Routing**: Automatic project identification from webhook payload
- **Backward Compatibility**: Maintains support for single-project setups

## Technical Details

### Database Schema
```sql
CREATE TABLE gitlab_projects (
  id INTEGER PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE,
  gitlab_url TEXT NOT NULL,
  token TEXT NOT NULL,
  webhook_secret TEXT NOT NULL,
  project_name TEXT,
  project_namespace TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### API Endpoints
- `POST /store` - Add/update project configuration
- `GET /get-credentials?project_id=123` - Get credentials for specific project
- `GET /list-projects` - List all configured projects
- `DELETE /remove-project?project_id=123` - Remove a project

### Webhook Processing
1. Extract project ID from webhook payload (`webhookData.project.id`)
2. Look up project-specific configuration in `gitlab_projects` table
3. Verify webhook secret against project-specific secret
4. Route to appropriate event handler with project context

## Usage Patterns

### Single Worker, Multiple Projects (Recommended)
```bash
# Same webhook URL for all projects
https://your-worker.workers.dev/webhooks/gitlab

# Each project configured with:
# - Unique project ID
# - Project-specific Personal Access Token
# - Project-specific webhook secret
```

### Configuration Example
```javascript
// Project A configuration
{
  projectId: "12345",
  gitlabUrl: "https://gitlab.com",
  token: "glpat-xxxxxxxxxxxxxxxxxxxx",
  webhookSecret: "secret-a",
  projectName: "My Project A",
  projectNamespace: "group/project-a"
}

// Project B configuration
{
  projectId: "67890",
  gitlabUrl: "https://gitlab.com",
  token: "glpat-yyyyyyyyyyyyyyyyyyyy",
  webhookSecret: "secret-b",
  projectName: "My Project B",
  projectNamespace: "group/project-b"
}
```

## Security Features

### Project Isolation
- Each project has its own Personal Access Token
- Webhook secrets are project-specific
- No cross-project data access

### Token Management
- Tokens encrypted using AES-256-GCM
- Per-project token validation
- Support for different GitLab instances per project

## Deployment Architecture

### Option 1: Single Worker Instance
- One Worker handles all projects
- Project identification via webhook payload
- Shared infrastructure, isolated configurations

### Option 2: Multiple Worker Instances
- Separate Worker per project or group
- Complete isolation between projects
- Higher resource usage but maximum security

### Option 3: Custom Domains
- Custom domains per project/group
- Professional appearance for clients
- Domain-based routing

## Migration Strategy

### From Single Project
1. Existing single-project configurations remain functional
2. New multi-project table created alongside existing schema
3. Gradual migration of projects to new system
4. Backward compatibility maintained

### Database Migration
```sql
-- Migration v4: Add multi-project support
CREATE TABLE IF NOT EXISTS gitlab_projects (
  id INTEGER PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE,
  gitlab_url TEXT NOT NULL,
  token TEXT NOT NULL,
  webhook_secret TEXT NOT NULL,
  project_name TEXT,
  project_namespace TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## Error Handling

### Project Not Found
- Returns 404 if project configuration not found
- Logs project ID for debugging
- Graceful fallback to first available project (backward compatibility)

### Token Validation
- Per-project token validation
- Specific error messages for each project
- Project-specific rate limiting

## Monitoring and Logging

### Project-Specific Metrics
- Track requests per project
- Monitor token usage by project
- Project-specific error rates

### Logging Context
```javascript
logWithContext('GITLAB_WEBHOOK', 'Processing webhook', {
  projectId: '12345',
  projectNamespace: 'group/project-a',
  objectKind: 'issue',
  action: 'open'
});
```

## Group-Level Support ✅ IMPLEMENTED

### Features
- GitLab group ID configuration
- Automatic project discovery within groups  
- Group-level permissions and tokens
- Fallback from project-specific to group-level configuration

### Database Schema
```sql
CREATE TABLE gitlab_groups (
  id INTEGER PRIMARY KEY,
  group_id TEXT NOT NULL UNIQUE,
  gitlab_url TEXT NOT NULL,
  token TEXT NOT NULL,
  webhook_secret TEXT NOT NULL,
  group_name TEXT,
  group_path TEXT,
  auto_discover_projects BOOLEAN DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### API Endpoints
- `POST /store-group` - Add/update group configuration
- `GET /get-group-credentials?group_id=123` - Get credentials for specific group
- `GET /list-groups` - List all configured groups
- `DELETE /remove-group?group_id=123` - Remove a group
- `POST /is-project-in-group` - Check if project belongs to configured group

### Configuration Example
```javascript
// Group configuration
{
  groupId: "456",
  gitlabUrl: "https://gitlab.com",
  token: "glpat-group-level-token",
  webhookSecret: "group-webhook-secret",
  groupName: "My Organization",
  groupPath: "my-org",
  autoDiscoverProjects: true
}
```

### Webhook Processing Logic
1. **Project-specific lookup**: First check for project-specific configuration
2. **Group fallback**: If no project config, check if project belongs to configured group
3. **Namespace matching**: Match project namespace against group paths
4. **Automatic discovery**: Use group credentials for any project in the group

### Benefits
- **Simplified management**: Configure once per group instead of per project
- **Automatic coverage**: New projects in group automatically supported
- **Hierarchical permissions**: Group-level tokens with broader access
- **Flexible configuration**: Mix project-specific and group-level configs

### Advanced Features
- Project-specific rate limiting
- Per-project Claude Code configurations
- Project templates and inheritance
- Bulk project operations

## Testing

### Test Coverage
- Multi-project webhook routing
- Project-specific credential retrieval
- Project isolation verification
- Migration compatibility testing

### Integration Tests
- Multiple project webhook processing
- Cross-project security validation
- Performance with large numbers of projects

## Success Criteria

### ✅ Completed
- Multiple projects supported in single Worker
- Project-specific configurations working
- Webhook routing by project ID functional
- Backward compatibility maintained
- Database schema updated with migration

### 🔄 Next Steps
- Group-level access implementation
- Management UI for projects
- Performance optimizations for large numbers of projects
- Advanced monitoring and analytics

## Configuration Examples

### Setup Multiple Projects
```javascript
// Configure Project A
POST /store
{
  "projectId": "12345",
  "gitlabUrl": "https://gitlab.com",
  "token": "glpat-project-a-token",
  "webhookSecret": "random-secret-a",
  "projectName": "Frontend App",
  "projectNamespace": "company/frontend"
}

// Configure Project B
POST /store
{
  "projectId": "67890",
  "gitlabUrl": "https://gitlab.com",
  "token": "glpat-project-b-token",
  "webhookSecret": "random-secret-b",
  "projectName": "Backend API",
  "projectNamespace": "company/backend"
}
```

### GitLab Webhook Configuration
```bash
# Same webhook URL for all projects
URL: https://your-worker.workers.dev/webhooks/gitlab

# Project A webhook secret: random-secret-a
# Project B webhook secret: random-secret-b
```

This multi-project support provides a scalable foundation for handling multiple GitLab projects while maintaining security isolation and configuration flexibility.