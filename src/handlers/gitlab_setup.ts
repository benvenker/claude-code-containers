import { logWithContext } from "../log";

// Validate GitLab token by making API call
async function validateGitLabToken(token: string, gitlabUrl: string): Promise<{ valid: boolean; error?: string; user?: any }> {
  try {
    const response = await fetch(`${gitlabUrl}/api/v4/user`, {
      headers: {
        'Private-Token': token
      }
    });
    
    if (response.ok) {
      const user = await response.json();
      return { valid: true, user };
    } else {
      return { valid: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
  } catch (error) {
    return { valid: false, error: `Network error: ${(error as Error).message}` };
  }
}

export async function handleGitLabSetup(request: Request, origin: string, env: any): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  logWithContext('GITLAB_SETUP', 'Handling GitLab setup request', { 
    pathname, 
    method: request.method,
    origin 
  });

  switch (pathname) {
    case '/gitlab-setup':
      return await showSetupForm(request, origin);
    case '/gitlab-setup/configure':
      return await configureGitLab(request, origin, env);
    case '/gitlab-setup/configure-group':
      return await configureGitLabGroup(request, origin, env);
    case '/gitlab-setup/status':
      return await getSetupStatus(request, env);
    default:
      return new Response('Not Found', { status: 404 });
  }
}

async function showSetupForm(_request: Request, origin: string): Promise<Response> {
  const webhookUrl = `${origin}/webhooks/gitlab`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>GitLab Integration Setup</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, select, textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        .info { background: #e7f3ff; padding: 10px; border-radius: 4px; margin-bottom: 20px; }
        .error { color: #dc3545; margin-top: 5px; }
        .success { color: #28a745; margin-top: 5px; }
      </style>
    </head>
    <body>
      <h1>GitLab Integration Setup</h1>
      
      <div class="info">
        <h3>Choose Your Setup Type:</h3>
        <p><strong>Single Project:</strong> Configure one specific GitLab project</p>
        <p><strong>Group Level:</strong> Configure an entire GitLab group (all projects automatically supported)</p>
      </div>
      
      <div class="form-group">
        <label>Setup Type:</label>
        <div>
          <input type="radio" id="projectMode" name="setupType" value="project" checked>
          <label for="projectMode" style="display: inline; margin-left: 5px;">Single Project</label>
        </div>
        <div>
          <input type="radio" id="groupMode" name="setupType" value="group">
          <label for="groupMode" style="display: inline; margin-left: 5px;">Group Level</label>
        </div>
      </div>
      
      <div class="info" id="projectInstructions">
        <h3>Project Setup Instructions:</h3>
        <ol>
          <li><strong>Create a Project Access Token</strong> (recommended):
            <ul>
              <li>Go to Project Settings → Access Tokens</li>
              <li>Name: "Claude Code Integration"</li>
              <li>Scopes: <code>api</code>, <code>read_repository</code>, <code>write_repository</code></li>
              <li>Role: <code>Developer</code> or <code>Maintainer</code></li>
            </ul>
          </li>
          <li>Get your GitLab project ID from project settings</li>
          <li>Configure webhook URL: <code>${webhookUrl}</code></li>
          <li>Generate a random webhook secret</li>
        </ol>
        <div style="background: #fff3cd; padding: 10px; border-radius: 4px; margin-top: 10px;">
          <strong>⚠️ Security Note:</strong> Project Access Tokens are more secure than Personal Access Tokens as they're limited to the specific project.
        </div>
      </div>
      
      <div class="info" id="groupInstructions" style="display: none;">
        <h3>Group Setup Instructions:</h3>
        <ol>
          <li><strong>Create a Group Access Token</strong> (recommended):
            <ul>
              <li>Go to Group Settings → Access Tokens</li>
              <li>Name: "Claude Code Integration"</li>
              <li>Scopes: <code>api</code>, <code>read_repository</code>, <code>write_repository</code></li>
              <li>Role: <code>Developer</code> or <code>Maintainer</code></li>
            </ul>
          </li>
          <li>Get your GitLab group ID and path from group settings</li>
          <li>Configure webhook URL: <code>${webhookUrl}</code> on ALL projects in the group</li>
          <li>Use the same webhook secret for all projects in the group</li>
        </ol>
        <div style="background: #fff3cd; padding: 10px; border-radius: 4px; margin-top: 10px;">
          <strong>⚠️ Security Note:</strong> Group Access Tokens are more secure than Personal Access Tokens as they're limited to the specific group.
        </div>
      </div>
      
      <form id="setupForm">
        <div class="form-group">
          <label for="gitlabUrl">GitLab URL:</label>
          <input type="url" id="gitlabUrl" name="gitlabUrl" value="https://gitlab.com" required>
        </div>
        
        <div class="form-group" id="projectIdGroup">
          <label for="projectId">Project ID:</label>
          <input type="text" id="projectId" name="projectId" placeholder="123456" required>
        </div>
        
        <div class="form-group" id="groupIdGroup" style="display: none;">
          <label for="groupId">Group ID:</label>
          <input type="text" id="groupId" name="groupId" placeholder="789">
        </div>
        
        <div class="form-group" id="groupPathGroup" style="display: none;">
          <label for="groupPath">Group Path:</label>
          <input type="text" id="groupPath" name="groupPath" placeholder="my-organization">
          <small>The group path as shown in GitLab URLs (e.g., 'my-org' for gitlab.com/my-org)</small>
        </div>
        
        <div class="form-group" id="groupNameGroup" style="display: none;">
          <label for="groupName">Group Name (optional):</label>
          <input type="text" id="groupName" name="groupName" placeholder="My Organization">
        </div>
        
        <div class="form-group">
          <label for="token">Access Token:</label>
          <input type="password" id="token" name="token" placeholder="glpat-xxxxxxxxxxxxxxxxxxxx" required>
          <small>Use Project Access Token (for single project) or Group Access Token (for group setup)</small>
        </div>
        
        <div class="form-group">
          <label for="webhookSecret">Webhook Secret:</label>
          <input type="password" id="webhookSecret" name="webhookSecret" placeholder="Generate a random secret" required>
        </div>
        
        <button type="submit" id="submitButton">Configure GitLab Project</button>
      </form>
      
      <div id="result"></div>
      
      <script>
        // Handle setup type switching
        document.querySelectorAll('input[name="setupType"]').forEach(radio => {
          radio.addEventListener('change', function() {
            const isGroupMode = this.value === 'group';
            
            // Show/hide instructions
            document.getElementById('projectInstructions').style.display = isGroupMode ? 'none' : 'block';
            document.getElementById('groupInstructions').style.display = isGroupMode ? 'block' : 'none';
            
            // Show/hide form fields
            document.getElementById('projectIdGroup').style.display = isGroupMode ? 'none' : 'block';
            document.getElementById('groupIdGroup').style.display = isGroupMode ? 'block' : 'none';
            document.getElementById('groupPathGroup').style.display = isGroupMode ? 'block' : 'none';
            document.getElementById('groupNameGroup').style.display = isGroupMode ? 'block' : 'none';
            
            // Update button text
            document.getElementById('submitButton').textContent = isGroupMode ? 'Configure GitLab Group' : 'Configure GitLab Project';
            
            // Update required fields
            document.getElementById('projectId').required = !isGroupMode;
            document.getElementById('groupId').required = isGroupMode;
            document.getElementById('groupPath').required = isGroupMode;
          });
        });
        
        document.getElementById('setupForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const formData = new FormData(e.target);
          const data = Object.fromEntries(formData);
          
          document.getElementById('result').innerHTML = '<div>Configuring...</div>';
          
          try {
            const isGroupMode = document.querySelector('input[name="setupType"]:checked').value === 'group';
            const endpoint = isGroupMode ? '/gitlab-setup/configure-group' : '/gitlab-setup/configure';
            
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
              const configType = isGroupMode ? 'group' : 'project';
              document.getElementById('result').innerHTML = 
                '<div class="success">✅ GitLab ' + configType + ' configured successfully!<br>Webhook URL: ' + result.webhookUrl + '</div>';
            } else {
              document.getElementById('result').innerHTML = 
                '<div class="error">❌ Error: ' + result.error + '</div>';
            }
          } catch (error) {
            document.getElementById('result').innerHTML = 
              '<div class="error">❌ Network error: ' + error.message + '</div>';
          }
        });
      </script>
    </body>
    </html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

async function configureGitLab(request: Request, origin: string, env: any): Promise<Response> {
  try {
    const data = await request.json();
    const { gitlabUrl, projectId, token, webhookSecret } = data;
    
    logWithContext('GITLAB_SETUP', 'Configuring GitLab integration', { 
      gitlabUrl, 
      projectId 
    });
    
    // Validate token
    const tokenValidation = await validateGitLabToken(token, gitlabUrl);
    if (!tokenValidation.valid) {
      return new Response(JSON.stringify({ error: tokenValidation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Store credentials in GitLabAppConfigDO
    const configDO = env.GITLAB_APP_CONFIG.get(env.GITLAB_APP_CONFIG.idFromString('config'));
    await configDO.fetch(new Request('http://config/store', {
      method: 'POST',
      body: JSON.stringify({ gitlabUrl, projectId, token, webhookSecret })
    }));
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'GitLab integration configured successfully',
      webhookUrl: `${origin}/webhooks/gitlab`
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function configureGitLabGroup(request: Request, origin: string, env: any): Promise<Response> {
  try {
    const data = await request.json();
    const { gitlabUrl, groupId, groupPath, groupName, token, webhookSecret } = data;
    
    logWithContext('GITLAB_SETUP', 'Configuring GitLab group integration', { 
      gitlabUrl, 
      groupId,
      groupPath
    });
    
    // Validate token
    const tokenValidation = await validateGitLabToken(token, gitlabUrl);
    if (!tokenValidation.valid) {
      return new Response(JSON.stringify({ error: tokenValidation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Store group credentials in GitLabAppConfigDO
    const configDO = env.GITLAB_APP_CONFIG.get(env.GITLAB_APP_CONFIG.idFromString('config'));
    await configDO.fetch(new Request('http://config/store-group', {
      method: 'POST',
      body: JSON.stringify({ 
        gitlabUrl, 
        groupId, 
        groupPath, 
        groupName, 
        token, 
        webhookSecret,
        autoDiscoverProjects: true
      })
    }));
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'GitLab group integration configured successfully',
      webhookUrl: `${origin}/webhooks/gitlab`
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function getSetupStatus(_request: Request, _env: any): Promise<Response> {
  // For now, return basic status (actual implementation will check Durable Object)
  return new Response(JSON.stringify({ 
    configured: false,
    message: 'GitLab integration not configured yet'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}