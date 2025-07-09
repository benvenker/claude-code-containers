import { logWithContext } from "../../log";
import { containerFetch } from "../../fetch";

// Simplified container response interface
interface ContainerResponse {
  success: boolean;
  message: string;
  error?: string;
}

// @duo-agent detection with code block filtering
function detectDuoAgentMention(text: string): boolean {
  if (!text) return false;
  
  // Remove code blocks to avoid false positives
  const textWithoutCode = text
    .replace(/`[^`]+`/g, '') // Remove inline code
    .replace(/```[\s\S]*?```/gm, '') // Remove code blocks
  
  return /@duo-agent\b/i.test(textWithoutCode);
}

// Extract user prompt from @duo-agent mention
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

// Route GitLab note to Claude Code container
async function routeToClaudeCodeContainer(
  noteData: any, 
  env: any, 
  configDO: any
): Promise<void> {
  const note = noteData.object_attributes;
  const project = noteData.project;
  const user = noteData.user;
  const isIssueComment = note.noteable_type === 'Issue';
  const isMRComment = note.noteable_type === 'MergeRequest';

  const containerName = `claude-gitlab-note-${note.id}`;

  logWithContext('GITLAB_CLAUDE_ROUTING', 'Routing GitLab note to Claude Code container', {
    noteId: note.id,
    containerName,
    noteableType: note.noteable_type,
    project: project.path_with_namespace,
    userPrompt: extractUserPrompt(note.note)
  });

  // Create unique container for this note
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
  const baseContext = {
    ANTHROPIC_API_KEY: claudeKeyData.anthropicApiKey,
    GITLAB_URL: credentials.url || 'https://gitlab.com',
    GITLAB_TOKEN: credentials.token,
    GITLAB_PROJECT_ID: credentials.projectId,
    
    // Comment context
    USER_PROMPT: extractUserPrompt(note.note),
    COMMENT_ID: note.id.toString(),
    DISCUSSION_ID: note.discussion_id || '',
    COMMENT_AUTHOR: user.username,
    
    // Project context
    PROJECT_NAMESPACE: project.path_with_namespace,
    GIT_CLONE_URL: project.git_http_url,
    
    MESSAGE: `Processing GitLab ${note.noteable_type} comment #${note.id}`
  };

  // Add context specific to issue or MR comments
  let noteContext;
  if (isIssueComment) {
    const issue = noteData.issue;
    noteContext = {
      ...baseContext,
      PROCESSING_MODE: 'issue_comment',
      ISSUE_IID: issue.iid.toString(),
      ISSUE_TITLE: issue.title,
      ISSUE_DESCRIPTION: issue.description || ''
    };
  } else if (isMRComment) {
    const mergeRequest = noteData.merge_request;
    noteContext = {
      ...baseContext,
      PROCESSING_MODE: 'mr_comment',
      MR_IID: mergeRequest.iid.toString(),
      MR_TITLE: mergeRequest.title,
      MR_DESCRIPTION: mergeRequest.description || '',
      SOURCE_BRANCH: mergeRequest.source_branch,
      TARGET_BRANCH: mergeRequest.target_branch
    };
  } else {
    throw new Error(`Unsupported noteable type: ${note.noteable_type}`);
  }

  // Start Claude Code processing by calling the container
  logWithContext('GITLAB_CLAUDE_ROUTING', 'Starting Claude Code container processing', {
    containerName,
    noteId: note.id,
    processingMode: noteContext.PROCESSING_MODE
  });

  try {
    const response = await containerFetch(container, new Request('http://internal/process-gitlab', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(noteContext)
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

// Handle GitLab note events
export async function handleGitLabNoteEvent(
  data: any, 
  env: any, 
  configDO: any
): Promise<Response> {
  const note = data.object_attributes;
  const project = data.project;
  const user = data.user;

  logWithContext('GITLAB_NOTE_EVENT', 'Processing GitLab note event', {
    noteId: note?.id,
    noteableType: note?.noteable_type,
    project: project?.path_with_namespace,
    author: user?.username,
    isSystem: note?.system,
    isBot: isBot(user)
  });

  // Filter out system notes
  if (note.system) {
    logWithContext('GITLAB_NOTE_EVENT', 'Ignoring system note', { noteId: note.id });
    return new Response('System note ignored', { status: 200 });
  }

  // Filter out bot comments
  if (isBot(user)) {
    logWithContext('GITLAB_NOTE_EVENT', 'Ignoring bot comment', { 
      noteId: note.id,
      username: user.username,
      isBot: user.bot
    });
    return new Response('Bot comment ignored', { status: 200 });
  }

  // Check for @duo-agent mention
  if (!detectDuoAgentMention(note.note)) {
    logWithContext('GITLAB_NOTE_EVENT', 'No @duo-agent mention found', { noteId: note.id });
    return new Response('No @duo-agent mention found', { status: 200 });
  }

  // Only process Issue and MergeRequest comments
  if (note.noteable_type !== 'Issue' && note.noteable_type !== 'MergeRequest') {
    logWithContext('GITLAB_NOTE_EVENT', 'Unsupported noteable type', { 
      noteId: note.id,
      noteableType: note.noteable_type
    });
    return new Response('Unsupported noteable type', { status: 200 });
  }

  // Handle @duo-agent comment processing
  logWithContext('GITLAB_NOTE_EVENT', 'Processing @duo-agent comment', {
    noteId: note.id,
    noteableType: note.noteable_type,
    userPrompt: extractUserPrompt(note.note).substring(0, 100) + '...'
  });

  try {
    // Route to Claude Code container for processing
    logWithContext('GITLAB_NOTE_EVENT', 'Routing to Claude Code container');
    await routeToClaudeCodeContainer(data, env, configDO);

    logWithContext('GITLAB_NOTE_EVENT', 'GitLab note routed to Claude Code container successfully');

    return new Response('GitLab note processed', { status: 200 });

  } catch (error) {
    logWithContext('GITLAB_NOTE_EVENT', 'Failed to process GitLab note', {
      error: error instanceof Error ? error.message : String(error),
      noteId: note?.id
    });

    return new Response('Failed to process note', { status: 500 });
  }
}