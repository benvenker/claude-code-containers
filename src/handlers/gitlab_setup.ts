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
        <h3>Setup Instructions:</h3>
        <ol>
          <li>Create a GitLab Personal Access Token with 'api' scope</li>
          <li>Get your GitLab project ID from project settings</li>
          <li>Configure webhook URL: <code>${webhookUrl}</code></li>
          <li>Generate a random webhook secret</li>
        </ol>
      </div>
      
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
          <small>Required scopes: api</small>
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
          e.preventDefault();
          
          const formData = new FormData(e.target);
          const data = Object.fromEntries(formData);
          
          document.getElementById('result').innerHTML = '<div>Configuring...</div>';
          
          try {
            const response = await fetch('/gitlab-setup/configure', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
              document.getElementById('result').innerHTML = 
                '<div class="success">✅ GitLab integration configured successfully!<br>Webhook URL: ' + result.webhookUrl + '</div>';
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
    
    // For now, just return success (actual storage will be implemented later)
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

async function getSetupStatus(_request: Request, _env: any): Promise<Response> {
  // For now, return basic status (actual implementation will check Durable Object)
  return new Response(JSON.stringify({ 
    configured: false,
    message: 'GitLab integration not configured yet'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}