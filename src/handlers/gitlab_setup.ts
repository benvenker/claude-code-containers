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
        <p><strong>Multiple Projects:</strong> Configure multiple individual GitLab projects</p>
        <p><strong>Group Level:</strong> Configure an entire GitLab group (all projects automatically supported)</p>
      </div>
      
      <div class="form-group">
        <label>Setup Type:</label>
        <div style="margin: 10px 0; padding: 15px; border: 2px solid #007bff; border-radius: 4px; background: #f0f8ff;">
          <input type="radio" id="projectMode" name="setupType" value="project" checked>
          <label for="projectMode" style="display: inline; margin-left: 8px; cursor: pointer; font-weight: bold; color: #007bff;">📁 Single Project</label>
          <p style="margin: 5px 0 0 25px; font-size: 14px; color: #666;">Configure one specific GitLab project</p>
        </div>
        <div style="margin: 10px 0; padding: 15px; border: 2px solid #ffc107; border-radius: 4px; background: #fffbf0;">
          <input type="radio" id="multiMode" name="setupType" value="multi">
          <label for="multiMode" style="display: inline; margin-left: 8px; cursor: pointer; font-weight: bold; color: #ffc107;">📚 Multiple Projects</label>
          <p style="margin: 5px 0 0 25px; font-size: 14px; color: #666;">Configure multiple individual GitLab projects (4+ repos)</p>
        </div>
        <div style="margin: 10px 0; padding: 15px; border: 2px solid #28a745; border-radius: 4px; background: #f0fff4;">
          <input type="radio" id="groupMode" name="setupType" value="group">
          <label for="groupMode" style="display: inline; margin-left: 8px; cursor: pointer; font-weight: bold; color: #28a745;">🏢 Group Level</label>
          <p style="margin: 5px 0 0 25px; font-size: 14px; color: #666;">Configure an entire GitLab group (all projects automatically supported)</p>
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
      
      <div class="info" id="multiInstructions" style="display: none;">
        <h3>Multiple Projects Setup Instructions:</h3>
        <ol>
          <li><strong>Create Project Access Tokens</strong> (recommended):
            <ul>
              <li>For each project: Go to Project Settings → Access Tokens</li>
              <li>Name: "Claude Code Integration"</li>
              <li>Scopes: <code>api</code>, <code>read_repository</code>, <code>write_repository</code></li>
              <li>Role: <code>Developer</code> or <code>Maintainer</code></li>
            </ul>
          </li>
          <li>Alternative: Use one Personal Access Token for all projects</li>
          <li>Configure webhook URL: <code>${webhookUrl}</code> on ALL projects</li>
          <li>Use different webhook secrets for each project (for security)</li>
          <li>Add projects one by one using the form below</li>
        </ol>
        <div style="background: #fff3cd; padding: 10px; border-radius: 4px; margin-top: 10px;">
          <strong>💡 Tip:</strong> You can mix Project Access Tokens and Personal Access Tokens across different projects.
        </div>
      </div>
      
      <div class="info" id="groupInstructions" style="display: none;">
        <h3>Group Setup Instructions:</h3>
        <ol>
          <li><strong>Create an Access Token</strong>:
            <ul>
              <li><strong>Option 1 - Group Access Token</strong> (if available):
                <ul>
                  <li>Go to Group Settings → Access Tokens</li>
                  <li>Name: "Claude Code Integration"</li>
                  <li>Scopes: <code>api</code>, <code>read_repository</code>, <code>write_repository</code></li>
                  <li>Role: <code>Developer</code> or <code>Maintainer</code></li>
                </ul>
              </li>
              <li><strong>Option 2 - Personal Access Token</strong> (if Group tokens unavailable):
                <ul>
                  <li>Go to User Settings → Access Tokens</li>
                  <li>Name: "Claude Code Integration"</li>
                  <li>Scopes: <code>api</code>, <code>read_repository</code>, <code>write_repository</code></li>
                </ul>
              </li>
            </ul>
          </li>
          <li>Get your GitLab group ID and path from group settings</li>
          <li>Configure webhook URL: <code>${webhookUrl}</code> on ALL projects in the group</li>
          <li>Use the same webhook secret for all projects in the group</li>
        </ol>
        <div style="background: #fff3cd; padding: 10px; border-radius: 4px; margin-top: 10px;">
          <strong>⚠️ Note:</strong> Group Access Tokens require GitLab Premium in some instances. Use Personal Access Token if unavailable.
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
        
        <!-- Multiple Projects Form -->
        <div id="multiProjectsForm" style="display: none;">
          <div style="background: #f8f9fa; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
            <h4>📋 Configured Projects</h4>
            <div id="projectsList">
              <p style="color: #666; font-style: italic;">No projects configured yet. Add your first project below.</p>
            </div>
          </div>
          
          <h4>➕ Add New Project</h4>
          <div class="form-group">
            <label for="multiProjectId">Project ID:</label>
            <input type="text" id="multiProjectId" placeholder="123456">
          </div>
          
          <div class="form-group">
            <label for="multiProjectName">Project Name (optional):</label>
            <input type="text" id="multiProjectName" placeholder="My Backend API">
          </div>
          
          <div class="form-group">
            <label for="multiProjectNamespace">Project Namespace:</label>
            <input type="text" id="multiProjectNamespace" placeholder="company/backend-api">
            <small>The full project path as shown in GitLab URLs</small>
          </div>
          
          <div class="form-group">
            <label for="multiToken">Access Token for this project:</label>
            <input type="password" id="multiToken" placeholder="glpat-xxxxxxxxxxxxxxxxxxxx">
            <small>Project Access Token (recommended) or Personal Access Token</small>
          </div>
          
          <div class="form-group">
            <label for="multiWebhookSecret">Webhook Secret for this project:</label>
            <input type="password" id="multiWebhookSecret" placeholder="Generate a unique secret for this project">
          </div>
          
          <button type="button" id="addProjectButton" style="background: #ffc107; color: #000; margin-bottom: 20px;">Add Project to List</button>
        </div>
        
        <!-- Single/Group Project Form -->
        <div id="singleGroupForm">
          <div class="form-group">
            <label for="token">Access Token:</label>
            <input type="password" id="token" name="token" placeholder="glpat-xxxxxxxxxxxxxxxxxxxx" required>
            <small>Use Project Access Token (for single project) or Group Access Token (for group setup)</small>
          </div>
          
          <div class="form-group">
            <label for="webhookSecret">Webhook Secret:</label>
            <input type="password" id="webhookSecret" name="webhookSecret" placeholder="Generate a random secret" required>
          </div>
        </div>
        
        <button type="submit" id="submitButton">Configure GitLab Project</button>
      </form>
      
      <div id="result"></div>
      
      <script>
        // Handle setup type switching
        let configuredProjects = [];
        
        document.querySelectorAll('input[name="setupType"]').forEach(radio => {
          radio.addEventListener('change', function() {
            const mode = this.value; // 'project', 'multi', or 'group'
            console.log('🔄 Setup type changed to:', mode);
            
            // Show/hide instructions
            const projectInstructions = document.getElementById('projectInstructions');
            const multiInstructions = document.getElementById('multiInstructions');
            const groupInstructions = document.getElementById('groupInstructions');
            
            if (projectInstructions) {
              projectInstructions.style.display = (mode === 'project') ? 'block' : 'none';
            }
            if (multiInstructions) {
              multiInstructions.style.display = (mode === 'multi') ? 'block' : 'none';
            }
            if (groupInstructions) {
              groupInstructions.style.display = (mode === 'group') ? 'block' : 'none';
            }
            
            // Show/hide form sections
            const projectIdGroup = document.getElementById('projectIdGroup');
            const groupIdGroup = document.getElementById('groupIdGroup');
            const groupPathGroup = document.getElementById('groupPathGroup');
            const groupNameGroup = document.getElementById('groupNameGroup');
            const multiProjectsForm = document.getElementById('multiProjectsForm');
            const singleGroupForm = document.getElementById('singleGroupForm');
            
            // Single project fields
            if (projectIdGroup) {
              projectIdGroup.style.display = (mode === 'project') ? 'block' : 'none';
            }
            
            // Group fields
            if (groupIdGroup) {
              groupIdGroup.style.display = (mode === 'group') ? 'block' : 'none';
            }
            if (groupPathGroup) {
              groupPathGroup.style.display = (mode === 'group') ? 'block' : 'none';
            }
            if (groupNameGroup) {
              groupNameGroup.style.display = (mode === 'group') ? 'block' : 'none';
            }
            
            // Multi-project form
            if (multiProjectsForm) {
              multiProjectsForm.style.display = (mode === 'multi') ? 'block' : 'none';
            }
            if (singleGroupForm) {
              singleGroupForm.style.display = (mode === 'multi') ? 'none' : 'block';
            }
            
            // Update button text
            const submitButton = document.getElementById('submitButton');
            if (submitButton) {
              if (mode === 'project') {
                submitButton.textContent = 'Configure GitLab Project';
              } else if (mode === 'multi') {
                submitButton.textContent = 'Configure All Projects';
                submitButton.style.display = configuredProjects.length > 0 ? 'block' : 'none';
              } else if (mode === 'group') {
                submitButton.textContent = 'Configure GitLab Group';
              }
            }
            
            // Update required fields
            const projectId = document.getElementById('projectId');
            const groupId = document.getElementById('groupId');
            const groupPath = document.getElementById('groupPath');
            
            if (projectId) {
              projectId.required = (mode === 'project');
            }
            if (groupId) {
              groupId.required = (mode === 'group');
            }
            if (groupPath) {
              groupPath.required = (mode === 'group');
            }
            
            console.log('✨ Setup type switching complete');
          });
        });
        
        // Handle adding projects to the list
        document.addEventListener('click', function(e) {
          if (e.target.id === 'addProjectButton') {
            const projectId = document.getElementById('multiProjectId').value;
            const projectName = document.getElementById('multiProjectName').value;
            const projectNamespace = document.getElementById('multiProjectNamespace').value;
            const token = document.getElementById('multiToken').value;
            const webhookSecret = document.getElementById('multiWebhookSecret').value;
            
            if (!projectId || !projectNamespace || !token || !webhookSecret) {
              alert('Please fill in all required fields (Project ID, Namespace, Token, Webhook Secret)');
              return;
            }
            
            // Add to configured projects
            const project = {
              projectId,
              projectName: projectName || 'Project ' + projectId,
              projectNamespace,
              token,
              webhookSecret
            };
            
            configuredProjects.push(project);
            console.log('➕ Added project:', project);
            
            // Update the projects list display
            updateProjectsList();
            
            // Clear the form
            document.getElementById('multiProjectId').value = '';
            document.getElementById('multiProjectName').value = '';
            document.getElementById('multiProjectNamespace').value = '';
            document.getElementById('multiToken').value = '';
            document.getElementById('multiWebhookSecret').value = '';
            
            // Show submit button
            const submitButton = document.getElementById('submitButton');
            if (submitButton) {
              submitButton.style.display = 'block';
            }
          }
        });
        
        function updateProjectsList() {
          const projectsList = document.getElementById('projectsList');
          if (configuredProjects.length === 0) {
            projectsList.innerHTML = '<p style="color: #666; font-style: italic;">No projects configured yet. Add your first project below.</p>';
            return;
          }
          
          let html = '';
          configuredProjects.forEach((project, index) => {
            html += `
              <div style="background: white; border: 1px solid #ddd; border-radius: 4px; padding: 10px; margin-bottom: 10px;">
                <strong>${project.projectName}</strong> (ID: ${project.projectId})
                <br><small>📁 ${project.projectNamespace}</small>
                <br><small>🔑 Token: ${project.token.substring(0, 8)}...</small>
                <br><small>🔐 Secret: ${project.webhookSecret.substring(0, 8)}...</small>
                <button type="button" onclick="removeProject(${index})" style="background: #dc3545; color: white; border: none; padding: 2px 8px; border-radius: 3px; font-size: 12px; margin-top: 5px;">Remove</button>
              </div>
            `;
          });
          projectsList.innerHTML = html;
        }
        
        function removeProject(index) {
          configuredProjects.splice(index, 1);
          updateProjectsList();
          
          // Hide submit button if no projects
          const submitButton = document.getElementById('submitButton');
          if (submitButton && configuredProjects.length === 0) {
            submitButton.style.display = 'none';
          }
        }
        
        // Debug: Log when page loads
        document.addEventListener('DOMContentLoaded', function() {
          console.log('GitLab setup page loaded');
          console.log('Found radio buttons:', document.querySelectorAll('input[name="setupType"]').length);
        });
        
        document.getElementById('setupForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const mode = document.querySelector('input[name="setupType"]:checked').value;
          document.getElementById('result').innerHTML = '<div>Configuring...</div>';
          
          try {
            if (mode === 'multi') {
              // Handle multiple projects submission
              if (configuredProjects.length === 0) {
                document.getElementById('result').innerHTML = 
                  '<div class="error">❌ Please add at least one project to the list</div>';
                return;
              }
              
              // Submit each project individually
              let successCount = 0;
              let errors = [];
              
              for (const project of configuredProjects) {
                try {
                  const response = await fetch('/gitlab-setup/configure', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      gitlabUrl: document.getElementById('gitlabUrl').value,
                      projectId: project.projectId,
                      token: project.token,
                      webhookSecret: project.webhookSecret,
                      projectName: project.projectName,
                      projectNamespace: project.projectNamespace
                    })
                  });
                  
                  if (response.ok) {
                    successCount++;
                  } else {
                    const error = await response.json();
                    errors.push(`${project.projectName}: ${error.error}`);
                  }
                } catch (error) {
                  errors.push(`${project.projectName}: ${error.message}`);
                }
              }
              
              let resultHtml = '';
              if (successCount > 0) {
                resultHtml += `<div class="success">✅ Successfully configured ${successCount} project(s)</div>`;
              }
              if (errors.length > 0) {
                resultHtml += `<div class="error">❌ Errors:<br>${errors.join('<br>')}</div>`;
              }
              
              document.getElementById('result').innerHTML = resultHtml;
              
            } else {
              // Handle single project or group submission
              const formData = new FormData(e.target);
              const data = Object.fromEntries(formData);
              
              const endpoint = (mode === 'group') ? '/gitlab-setup/configure-group' : '/gitlab-setup/configure';
              
              const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
              });
              
              const result = await response.json();
              
              if (response.ok) {
                const configType = (mode === 'group') ? 'group' : 'project';
                document.getElementById('result').innerHTML = 
                  '<div class="success">✅ GitLab ' + configType + ' configured successfully!<br>Webhook URL: ' + result.webhookUrl + '</div>';
              } else {
                document.getElementById('result').innerHTML = 
                  '<div class="error">❌ Error: ' + result.error + '</div>';
              }
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