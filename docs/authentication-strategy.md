# GitLab Authentication Strategy

## Overview

This document details the authentication strategy for GitLab integration, focusing on Personal Access Tokens (PATs) as the primary authentication method and secure credential storage.

## Authentication Methods

### GitLab Personal Access Tokens (Recommended)

Unlike GitHub Apps which require complex OAuth flows, GitLab Personal Access Tokens provide a simpler, more direct authentication method.

**Advantages:**
- **Simplicity**: No OAuth flow required
- **Direct API access**: Full GitLab API access with single token
- **Project-level granularity**: Can be scoped to specific projects
- **Easy rotation**: Simple token refresh process
- **No webhook complexities**: Direct token-based API calls

**Required Scopes:**
- `api` - Full API access (required for all operations)
- `read_repository` - Read repository content
- `write_repository` - Push commits and create branches

### Token Types

#### 1. Project Access Tokens (Recommended)
- **Scope**: Limited to specific project
- **Security**: Minimal blast radius if compromised
- **Use case**: Single project deployments
- **Expiration**: Can be set to expire (recommended)

#### 2. Personal Access Tokens
- **Scope**: Full user access
- **Security**: Higher risk if compromised
- **Use case**: Multi-project deployments
- **Expiration**: Should be set with regular rotation

#### 3. Group Access Tokens
- **Scope**: All projects in a group
- **Security**: Moderate risk
- **Use case**: Organization-wide deployments
- **Expiration**: Recommended for security

## Token Management

### Secure Storage Architecture

```typescript
// Durable Object for GitLab credentials
export class GitLabAppConfigDO {
  private storage: DurableObjectStorage
  private env: Env
  
  constructor(controller: DurableObjectState, env: Env) {
    this.storage = controller.storage
    this.env = env
  }
  
  async storeCredentials(credentials: GitLabCredentials): Promise<void> {
    const encrypted = await this.encrypt(credentials)
    await this.storage.put('gitlab_credentials', encrypted)
  }
  
  async getCredentials(): Promise<GitLabCredentials | null> {
    const encrypted = await this.storage.get('gitlab_credentials')
    if (!encrypted) return null
    
    return await this.decrypt(encrypted)
  }
}

interface GitLabCredentials {
  token: string
  url: string
  projectId: string
  webhookSecret: string
  createdAt: string
  expiresAt?: string
  tokenType: 'project' | 'personal' | 'group'
}
```

### Encryption Implementation

```typescript
class GitLabCredentialEncryption {
  private key: CryptoKey
  
  constructor(private secretKey: string) {}
  
  async encrypt(credentials: GitLabCredentials): Promise<string> {
    const key = await this.getEncryptionKey()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    
    const encoded = new TextEncoder().encode(JSON.stringify(credentials))
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    )
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength)
    combined.set(iv)
    combined.set(new Uint8Array(encrypted), iv.length)
    
    return btoa(String.fromCharCode(...combined))
  }
  
  async decrypt(encryptedData: string): Promise<GitLabCredentials> {
    const key = await this.getEncryptionKey()
    const combined = new Uint8Array(
      atob(encryptedData).split('').map(char => char.charCodeAt(0))
    )
    
    const iv = combined.slice(0, 12)
    const encrypted = combined.slice(12)
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    )
    
    const decoded = new TextDecoder().decode(decrypted)
    return JSON.parse(decoded)
  }
  
  private async getEncryptionKey(): Promise<CryptoKey> {
    if (!this.key) {
      const keyData = new TextEncoder().encode(this.secretKey)
      const hash = await crypto.subtle.digest('SHA-256', keyData)
      
      this.key = await crypto.subtle.importKey(
        'raw',
        hash,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      )
    }
    
    return this.key
  }
}
```

## Webhook Authentication

### GitLab Webhook Signature Verification

GitLab uses a simpler authentication model than GitHub - direct token comparison instead of HMAC signatures.

```typescript
function verifyGitLabWebhook(token: string, expectedSecret: string): boolean {
  if (!expectedSecret) {
    console.warn('No webhook secret configured - this is insecure!')
    return true // Allow for development, but log warning
  }
  
  // Direct string comparison (constant-time to prevent timing attacks)
  return crypto.subtle.timingSafeEqual(
    new TextEncoder().encode(token),
    new TextEncoder().encode(expectedSecret)
  )
}

// Helper for timing-safe string comparison
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i]
  }
  
  return result === 0
}
```

### Webhook Headers

```typescript
interface GitLabWebhookHeaders {
  'X-Gitlab-Token': string      // Webhook secret token
  'X-Gitlab-Event': string      // Event type (Issue Hook, Note Hook, etc.)
  'Content-Type': 'application/json'
  'User-Agent': string          // GitLab version info
}
```

## Token Validation

### API Token Validation

```typescript
async function validateGitLabToken(token: string, gitlabUrl: string): Promise<TokenValidationResult> {
  try {
    const response = await fetch(`${gitlabUrl}/api/v4/user`, {
      headers: {
        'Private-Token': token
      }
    })
    
    if (response.ok) {
      const user = await response.json()
      return {
        valid: true,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email
        },
        scopes: response.headers.get('X-GitLab-Token-Scopes')?.split(',') || []
      }
    } else {
      return {
        valid: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      }
    }
  } catch (error) {
    return {
      valid: false,
      error: `Network error: ${error.message}`
    }
  }
}

interface TokenValidationResult {
  valid: boolean
  user?: {
    id: number
    username: string
    name: string
    email: string
  }
  scopes?: string[]
  error?: string
}
```

### Project Access Validation

```typescript
async function validateProjectAccess(
  token: string, 
  gitlabUrl: string, 
  projectId: string
): Promise<ProjectAccessResult> {
  try {
    const response = await fetch(`${gitlabUrl}/api/v4/projects/${projectId}`, {
      headers: {
        'Private-Token': token
      }
    })
    
    if (response.ok) {
      const project = await response.json()
      return {
        hasAccess: true,
        project: {
          id: project.id,
          name: project.name,
          path: project.path_with_namespace,
          permissions: project.permissions
        }
      }
    } else {
      return {
        hasAccess: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      }
    }
  } catch (error) {
    return {
      hasAccess: false,
      error: `Network error: ${error.message}`
    }
  }
}
```

## Setup Flow

### GitLab Setup Handler

```typescript
// src/handlers/gitlab_setup.ts
export async function handleGitLabSetup(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname
  
  switch (path) {
    case '/gitlab-setup':
      return await showSetupForm(request, env)
    case '/gitlab-setup/configure':
      return await configureGitLab(request, env)
    case '/gitlab-setup/validate':
      return await validateConfiguration(request, env)
    case '/gitlab-setup/status':
      return await getSetupStatus(request, env)
    default:
      return new Response('Not Found', { status: 404 })
  }
}

async function showSetupForm(request: Request, env: Env): Promise<Response> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>GitLab Setup</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, select, textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        .error { color: #dc3545; margin-top: 5px; }
        .success { color: #28a745; margin-top: 5px; }
      </style>
    </head>
    <body>
      <h1>GitLab Integration Setup</h1>
      
      <form id="setupForm">
        <div class="form-group">
          <label for="gitlabUrl">GitLab URL:</label>
          <input type="url" id="gitlabUrl" name="gitlabUrl" value="https://gitlab.com" required>
        </div>
        
        <div class="form-group">
          <label for="projectId">Project ID:</label>
          <input type="text" id="projectId" name="projectId" placeholder="123456" required>
        </div>
        
        <div class="form-group">
          <label for="token">Personal Access Token:</label>
          <input type="password" id="token" name="token" placeholder="glpat-xxxxxxxxxxxxxxxxxxxx" required>
          <small>Required scopes: api, read_repository, write_repository</small>
        </div>
        
        <div class="form-group">
          <label for="webhookSecret">Webhook Secret:</label>
          <input type="password" id="webhookSecret" name="webhookSecret" placeholder="Generate a random secret" required>
        </div>
        
        <button type="submit">Configure GitLab</button>
      </form>
      
      <div id="result"></div>
      
      <script>
        document.getElementById('setupForm').addEventListener('submit', async (e) => {
          e.preventDefault()
          
          const formData = new FormData(e.target)
          const data = Object.fromEntries(formData)
          
          try {
            const response = await fetch('/gitlab-setup/configure', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            })
            
            const result = await response.json()
            
            if (response.ok) {
              document.getElementById('result').innerHTML = 
                '<div class="success">✅ GitLab integration configured successfully!</div>'
            } else {
              document.getElementById('result').innerHTML = 
                '<div class="error">❌ Error: ' + result.error + '</div>'
            }
          } catch (error) {
            document.getElementById('result').innerHTML = 
              '<div class="error">❌ Network error: ' + error.message + '</div>'
          }
        })
      </script>
    </body>
    </html>
  `
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  })
}

async function configureGitLab(request: Request, env: Env): Promise<Response> {
  try {
    const data = await request.json()
    const { gitlabUrl, projectId, token, webhookSecret } = data
    
    // Validate token
    const tokenValidation = await validateGitLabToken(token, gitlabUrl)
    if (!tokenValidation.valid) {
      return new Response(JSON.stringify({ error: tokenValidation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Validate project access
    const projectValidation = await validateProjectAccess(token, gitlabUrl, projectId)
    if (!projectValidation.hasAccess) {
      return new Response(JSON.stringify({ error: projectValidation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Store credentials
    const credentials: GitLabCredentials = {
      token,
      url: gitlabUrl,
      projectId,
      webhookSecret,
      createdAt: new Date().toISOString(),
      tokenType: 'personal' // Can be detected or user-specified
    }
    
    const configDO = env.GITLAB_APP_CONFIG.get(env.GITLAB_APP_CONFIG.idFromString('config'))
    await configDO.fetch('http://config/store', {
      method: 'POST',
      body: JSON.stringify(credentials)
    })
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'GitLab integration configured successfully',
      webhookUrl: `${new URL(request.url).origin}/webhooks/gitlab`
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
```

## Security Best Practices

### Token Security

1. **Minimal Scopes**: Only request necessary permissions
2. **Expiration**: Set token expiration dates
3. **Rotation**: Implement regular token rotation
4. **Monitoring**: Log token usage and detect anomalies

### Storage Security

1. **Encryption**: All credentials encrypted at rest
2. **Key Management**: Secure key derivation and storage
3. **Access Controls**: Limit access to credential storage
4. **Audit Logging**: Track all credential access

### Network Security

1. **HTTPS Only**: All API calls over HTTPS
2. **Certificate Validation**: Verify SSL certificates
3. **Rate Limiting**: Prevent brute force attacks
4. **IP Whitelisting**: Restrict webhook sources (if possible)

## Error Handling

### Authentication Errors

```typescript
enum AuthError {
  INVALID_TOKEN = 'Invalid or expired token',
  INSUFFICIENT_PERMISSIONS = 'Insufficient permissions',
  NETWORK_ERROR = 'Network connectivity error',
  RATE_LIMITED = 'Rate limit exceeded',
  TOKEN_EXPIRED = 'Token has expired'
}

function handleAuthError(error: AuthError, context: string): Response {
  console.error(`Authentication error in ${context}:`, error)
  
  switch (error) {
    case AuthError.INVALID_TOKEN:
    case AuthError.TOKEN_EXPIRED:
      return new Response('Authentication required', { status: 401 })
    case AuthError.INSUFFICIENT_PERMISSIONS:
      return new Response('Insufficient permissions', { status: 403 })
    case AuthError.RATE_LIMITED:
      return new Response('Rate limit exceeded', { status: 429 })
    default:
      return new Response('Authentication error', { status: 500 })
  }
}
```

### Token Refresh Strategy

```typescript
class GitLabTokenManager {
  private credentials: GitLabCredentials
  
  async ensureValidToken(): Promise<string> {
    // Check if token is expired
    if (this.credentials.expiresAt && 
        new Date(this.credentials.expiresAt) <= new Date()) {
      throw new Error('Token expired - manual refresh required')
    }
    
    // Validate token with API call
    const validation = await validateGitLabToken(
      this.credentials.token, 
      this.credentials.url
    )
    
    if (!validation.valid) {
      throw new Error(`Token validation failed: ${validation.error}`)
    }
    
    return this.credentials.token
  }
}
```

## Monitoring and Alerts

### Authentication Metrics

```typescript
interface AuthMetrics {
  tokenValidations: number
  tokenFailures: number
  webhookSignatureFailures: number
  projectAccessChecks: number
  lastTokenRefresh: string
}

function trackAuthMetrics(metric: keyof AuthMetrics): void {
  // Implementation depends on monitoring system
  console.log(`AUTH_METRIC: ${metric}`)
}
```

### Health Checks

```typescript
async function checkGitLabHealth(credentials: GitLabCredentials): Promise<HealthCheck> {
  const checks = await Promise.allSettled([
    validateGitLabToken(credentials.token, credentials.url),
    validateProjectAccess(credentials.token, credentials.url, credentials.projectId)
  ])
  
  return {
    healthy: checks.every(check => check.status === 'fulfilled'),
    checks: {
      tokenValid: checks[0].status === 'fulfilled',
      projectAccess: checks[1].status === 'fulfilled'
    },
    timestamp: new Date().toISOString()
  }
}
```

This authentication strategy provides:
- **Secure credential storage** with encryption
- **Simple token-based authentication** without complex OAuth
- **Comprehensive validation** of tokens and permissions
- **Easy setup flow** for user configuration
- **Robust error handling** and monitoring
- **Security best practices** implementation