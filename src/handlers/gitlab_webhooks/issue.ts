import { logWithContext } from "../../log";
import { containerFetch } from "../../fetch";

// Simplified container response interface
interface ContainerResponse {
  success: boolean;
  message: string;
  error?: string;
}

// Route GitLab issue to Claude Code container
async function routeToClaudeCodeContainer(
  issueData: any, 
  env: any, 
  configDO: any
): Promise<void> {
  const issue = issueData.object_attributes;
  const project = issueData.project;
  const user = issueData.user;

  const containerName = `claude-gitlab-issue-${issue.id}`;

  logWithContext('GITLAB_CLAUDE_ROUTING', 'Routing GitLab issue to Claude Code container', {
    issueIid: issue.iid,
    issueId: issue.id,
    containerName,
    project: project.path_with_namespace
  });

  // Create unique container for this issue
  const id = env.MY_CONTAINER.idFromName(containerName);
  const container = env.MY_CONTAINER.get(id);

  // Get GitLab credentials from configDO
  logWithContext('GITLAB_CLAUDE_ROUTING', 'Retrieving GitLab credentials');

  const credentialsResponse = await configDO.fetch(new Request('http://internal/get-credentials'));
  const credentials = await credentialsResponse.json();

  logWithContext('GITLAB_CLAUDE_ROUTING', 'GitLab credentials retrieved', {
    hasToken: !!credentials.token,
    url: credentials.url
  });

  // Get Claude API key from secure storage (stored in GitHub Durable Object)
  logWithContext('GITLAB_CLAUDE_ROUTING', 'Retrieving Claude API key');

  const claudeConfigId = env.GITHUB_APP_CONFIG.idFromName('claude-config');
  const claudeConfigDO = env.GITHUB_APP_CONFIG.get(claudeConfigId);
  const claudeKeyResponse = await claudeConfigDO.fetch(new Request('http://internal/get-claude-key'));
  const claudeKeyData = await claudeKeyResponse.json();

  logWithContext('GITLAB_CLAUDE_ROUTING', 'Claude API key check', {
    hasApiKey: !!claudeKeyData.anthropicApiKey
  });

  if (!claudeKeyData.anthropicApiKey) {
    logWithContext('GITLAB_CLAUDE_ROUTING', 'Claude API key not configured');
    throw new Error('Claude API key not configured. Please visit /claude-setup first.');
  }

  // Prepare environment variables for the container (GitLab format)
  const issueContext = {
    ANTHROPIC_API_KEY: claudeKeyData.anthropicApiKey,
    GITLAB_URL: credentials.url || 'https://gitlab.com',
    GITLAB_TOKEN: credentials.token,
    GITLAB_PROJECT_ID: credentials.projectId,
    PROCESSING_MODE: 'issue',
    
    // Issue context
    ISSUE_IID: issue.iid.toString(),
    ISSUE_TITLE: issue.title,
    ISSUE_DESCRIPTION: issue.description || '',
    ISSUE_LABELS: JSON.stringify(issue.labels?.map((label: any) => label.name) || []),
    
    // Project context
    PROJECT_NAMESPACE: project.path_with_namespace,
    GIT_CLONE_URL: project.git_http_url,
    
    // User context
    ISSUE_AUTHOR: user.username,
    
    MESSAGE: `Processing GitLab issue #${issue.iid}: ${issue.title}`
  };

  // Start Claude Code processing by calling the container
  logWithContext('GITLAB_CLAUDE_ROUTING', 'Starting Claude Code container processing', {
    containerName,
    issueIid: issueContext.ISSUE_IID
  });

  try {
    const response = await containerFetch(container, new Request('http://internal/process-gitlab', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(issueContext)
    }), {
      containerName,
      route: '/process-gitlab'
    });

    logWithContext('GITLAB_CLAUDE_ROUTING', 'Claude Code container response', {
      status: response.status,
      statusText: response.statusText
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      logWithContext('GITLAB_CLAUDE_ROUTING', 'Container returned error', {
        status: response.status,
        errorText
      });
      throw new Error(`Container returned status ${response.status}: ${errorText}`);
    }

    // Parse container response
    const containerResponse: ContainerResponse = await response.json();
    
    logWithContext('GITLAB_CLAUDE_ROUTING', 'Container response parsed', {
      success: containerResponse.success,
      message: containerResponse.message,
      hasError: !!containerResponse.error
    });

    if (containerResponse.success) {
      logWithContext('GITLAB_CLAUDE_ROUTING', 'Container processing completed successfully', {
        message: containerResponse.message
      });
    } else {
      logWithContext('GITLAB_CLAUDE_ROUTING', 'Container processing failed', {
        error: containerResponse.error
      });
    }

  } catch (error) {
    logWithContext('GITLAB_CLAUDE_ROUTING', 'Failed to process Claude Code response', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

// Handle GitLab issues events
export async function handleGitLabIssuesEvent(
  data: any, 
  env: any, 
  configDO: any
): Promise<Response> {
  const action = data.object_attributes?.action;
  const issue = data.object_attributes;
  const project = data.project;
  const user = data.user;

  logWithContext('GITLAB_ISSUES_EVENT', 'Processing GitLab issue event', {
    action,
    issueIid: issue?.iid,
    issueTitle: issue?.title,
    project: project?.path_with_namespace,
    author: user?.username,
    labels: issue?.labels?.map((label: any) => label.name) || []
  });

  // Handle new issue creation with Claude Code
  if (action === 'open') {
    logWithContext('GITLAB_ISSUES_EVENT', 'Handling new GitLab issue creation');

    try {
      // TEMPORARY: Skip container processing due to authorization issues
      logWithContext('GITLAB_ISSUES_EVENT', 'Container processing temporarily disabled - acknowledging webhook');
      
      // TODO: Re-enable container processing once authorization is resolved
      // await routeToClaudeCodeContainer(data, env, configDO);

      logWithContext('GITLAB_ISSUES_EVENT', 'GitLab issue acknowledged (container processing disabled)');

      return new Response('GitLab issue acknowledged', { status: 200 });

    } catch (error) {
      logWithContext('GITLAB_ISSUES_EVENT', 'Failed to process new GitLab issue', {
        error: error instanceof Error ? error.message : String(error),
        issueIid: issue?.iid
      });

      return new Response('Failed to process issue', { status: 500 });
    }
  }

  // For non-open actions, acknowledge but don't process
  logWithContext('GITLAB_ISSUES_EVENT', 'Ignoring non-open issue action', { action });
  return new Response('GitLab issue event acknowledged', { status: 200 });
}