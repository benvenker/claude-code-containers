import { logWithContext } from "../../log";
import { containerFetch } from "../../fetch";

// Simplified container response interface
interface ContainerResponse {
  success: boolean;
  message: string;
  error?: string;
}

// @duo-agent detection with code block filtering (reused from note handler)
function detectDuoAgentMention(text: string): boolean {
  if (!text) return false;
  
  // Remove code blocks to avoid false positives
  const textWithoutCode = text
    .replace(/`[^`]+`/g, '') // Remove inline code
    .replace(/```[\s\S]*?```/gm, '') // Remove code blocks
  
  return /@duo-agent\b/i.test(textWithoutCode);
}

// Extract user instructions from @duo-agent mention
function extractUserPrompt(text: string): string {
  const match = text.match(/@duo-agent\s+(.+)/is);
  return match ? match[1].trim() : '';
}

// Check if user is a bot
function isBot(user: any): boolean {
  return user.bot === true || 
         user.username?.includes('bot') ||
         user.username?.includes('gitlab-bot') ||
         user.username === 'ghost';
}

// Route GitLab MR to Claude Code container
async function routeToClaudeCodeContainer(
  mrData: any, 
  env: any, 
  configDO: any
): Promise<void> {
  const mr = mrData.object_attributes;
  const project = mrData.project;
  const user = mrData.user;

  const containerName = `claude-gitlab-mr-${mr.id}`;

  logWithContext('GITLAB_CLAUDE_ROUTING', 'Routing GitLab MR to Claude Code container', {
    mrId: mr.id,
    mrIid: mr.iid,
    containerName,
    project: project.path_with_namespace,
    userPrompt: extractUserPrompt(mr.description)
  });

  // Create unique container for this MR
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

  // Get Claude API key from secure storage in GitLab Durable Object
  logWithContext('GITLAB_CLAUDE_ROUTING', 'Retrieving Claude API key');

  const claudeConfigId = env.GITLAB_APP_CONFIG.idFromName('claude-config');
  const claudeConfigDO = env.GITLAB_APP_CONFIG.get(claudeConfigId);
  const claudeKeyResponse = await claudeConfigDO.fetch(new Request('http://internal/get-claude-key'));
  const claudeKeyData = await claudeKeyResponse.json();

  logWithContext('GITLAB_CLAUDE_ROUTING', 'Claude API key check', {
    hasApiKey: !!claudeKeyData.anthropicApiKey
  });

  if (!claudeKeyData.anthropicApiKey) {
    logWithContext('GITLAB_CLAUDE_ROUTING', 'Claude API key not configured');
    throw new Error('Claude API key not configured. Please visit /claude-setup first.');
  }

  // Prepare environment variables for the container
  const mrContext = {
    ANTHROPIC_API_KEY: claudeKeyData.anthropicApiKey,
    GITLAB_URL: credentials.url || 'https://gitlab.com',
    GITLAB_TOKEN: credentials.token,
    GITLAB_PROJECT_ID: credentials.projectId,
    
    // Processing mode for MR creation
    PROCESSING_MODE: 'mr_creation',
    
    // MR context
    USER_PROMPT: extractUserPrompt(mr.description),
    MR_IID: mr.iid.toString(),
    MR_TITLE: mr.title,
    MR_DESCRIPTION: mr.description || '',
    SOURCE_BRANCH: mr.source_branch,
    TARGET_BRANCH: mr.target_branch,
    MR_AUTHOR: user.username,
    
    // Project context
    PROJECT_NAMESPACE: project.path_with_namespace,
    GIT_CLONE_URL: project.git_http_url,
    
    MESSAGE: `Processing GitLab MR creation #${mr.iid}`
  };

  // Start Claude Code processing by calling the container
  logWithContext('GITLAB_CLAUDE_ROUTING', 'Starting Claude Code container processing', {
    containerName,
    mrId: mr.id,
    mrIid: mr.iid,
    processingMode: mrContext.PROCESSING_MODE
  });

  try {
    const response = await containerFetch(container, new Request('http://internal/process-gitlab', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mrContext)
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

// Handle GitLab merge request events
export async function handleGitLabMergeRequestEvent(
  data: any, 
  env: any, 
  configDO: any
): Promise<Response> {
  const mr = data.object_attributes;
  const project = data.project;
  const user = data.user;

  logWithContext('GITLAB_MR_EVENT', 'Processing GitLab merge request event', {
    mrId: mr?.id,
    mrIid: mr?.iid,
    action: mr?.action,
    project: project?.path_with_namespace,
    author: user?.username,
    isBot: isBot(user)
  });

  // Only process "open" action events
  if (mr.action !== 'open') {
    logWithContext('GITLAB_MR_EVENT', 'Ignoring non-open MR action', { 
      mrId: mr.id,
      action: mr.action
    });
    return new Response('Non-open MR action ignored', { status: 200 });
  }

  // Filter out bot-created MRs
  if (isBot(user)) {
    logWithContext('GITLAB_MR_EVENT', 'Ignoring bot-created MR', { 
      mrId: mr.id,
      username: user.username,
      isBot: user.bot
    });
    return new Response('Bot MR ignored', { status: 200 });
  }

  // Check for @duo-agent mention in MR description
  if (!detectDuoAgentMention(mr.description)) {
    logWithContext('GITLAB_MR_EVENT', 'No @duo-agent mention found in MR description', { 
      mrId: mr.id,
      mrIid: mr.iid
    });
    return new Response('No @duo-agent mention found', { status: 200 });
  }

  // Handle @duo-agent MR processing
  logWithContext('GITLAB_MR_EVENT', 'Processing @duo-agent MR instructions', {
    mrId: mr.id,
    mrIid: mr.iid,
    userPrompt: extractUserPrompt(mr.description).substring(0, 100) + '...'
  });

  try {
    // Route to Claude Code container for processing
    logWithContext('GITLAB_MR_EVENT', 'Routing to Claude Code container');
    await routeToClaudeCodeContainer(data, env, configDO);

    logWithContext('GITLAB_MR_EVENT', 'GitLab MR routed to Claude Code container successfully');

    return new Response('GitLab MR processed', { status: 200 });

  } catch (error) {
    logWithContext('GITLAB_MR_EVENT', 'Failed to process GitLab MR', {
      error: error instanceof Error ? error.message : String(error),
      mrId: mr?.id,
      mrIid: mr?.iid
    });

    return new Response('Failed to process MR', { status: 500 });
  }
}