import { logWithContext } from "../../log";
import { containerFetch } from "../../fetch";
import { enhanceMRCommentContext } from "./context_aware";

// Enhanced GitLab note handler with context-aware processing
// This extends the existing note handler with file/line context and discussion threading

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

// Generate GitLab URLs for references
function generateGitLabUrls(project: any, noteData: any): any {
  const baseUrl = project.web_url || `https://gitlab.com/${project.path_with_namespace}`;
  const urls: any = {
    PROJECT_URL: baseUrl
  };

  // Add specific URLs based on noteable type
  if (noteData.object_attributes.noteable_type === 'MergeRequest') {
    const mrIid = noteData.merge_request.iid;
    urls.MR_URL = `${baseUrl}/-/merge_requests/${mrIid}`;
    
    if (noteData.object_attributes.discussion_id) {
      urls.DISCUSSION_URL = `${baseUrl}/-/merge_requests/${mrIid}#note_${noteData.object_attributes.id}`;
    }
  } else if (noteData.object_attributes.noteable_type === 'Issue') {
    const issueIid = noteData.issue.iid;
    urls.ISSUE_URL = `${baseUrl}/-/issues/${issueIid}`;
    
    if (noteData.object_attributes.discussion_id) {
      urls.DISCUSSION_URL = `${baseUrl}/-/issues/${issueIid}#note_${noteData.object_attributes.id}`;
    }
  }

  return urls;
}

// Enhanced route to Claude Code container with context-aware processing
async function routeToEnhancedClaudeCodeContainer(
  noteData: any, 
  env: any, 
  configDO: any
): Promise<void> {
  const note = noteData.object_attributes;
  const project = noteData.project;
  const user = noteData.user;
  const isIssueComment = note.noteable_type === 'Issue';
  const isMRComment = note.noteable_type === 'MergeRequest';

  const containerName = `claude-gitlab-note-enhanced-${note.id}`;

  logWithContext('GITLAB_ENHANCED_ROUTING', 'Routing enhanced GitLab note to Claude Code container', {
    noteId: note.id,
    containerName,
    noteableType: note.noteable_type,
    project: project.path_with_namespace,
    userPrompt: extractUserPrompt(note.note),
    hasPosition: !!note.position
  });

  // Create unique container for this note
  const id = env.MY_CONTAINER.idFromName(containerName);
  const container = env.MY_CONTAINER.get(id);

  // Get GitLab credentials from configDO
  const credentialsResponse = await configDO.fetch(new Request('http://internal/get-credentials'));
  const credentials = await credentialsResponse.json();

  // Get Claude API key from secure storage in GitLab Durable Object
  const claudeConfigId = env.GITLAB_APP_CONFIG.idFromName('claude-config');
  const claudeConfigDO = env.GITLAB_APP_CONFIG.get(claudeConfigId);
  const claudeKeyResponse = await claudeConfigDO.fetch(new Request('http://internal/get-claude-key'));
  const claudeKeyData = await claudeKeyResponse.json();

  if (!claudeKeyData.anthropicApiKey) {
    throw new Error('Claude API key not configured. Please visit /claude-setup first.');
  }

  // Generate reference URLs
  const gitlabUrls = generateGitLabUrls(project, noteData);

  // Prepare base environment variables for the container
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
    
    // Reference URLs
    ...gitlabUrls,
    
    MESSAGE: `Processing enhanced GitLab ${note.noteable_type} comment #${note.id}`
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
      ISSUE_DESCRIPTION: issue.description || '',
      THREAD_CONTEXT: JSON.stringify({
        discussionId: note.discussion_id,
        threadComments: [],
        totalComments: 0
      }),
      
      // Context-aware processing flag
      CONTEXT_AWARE_PROCESSING: 'true',
      ENHANCED_CONTEXT: JSON.stringify({
        hasFileContext: false,
        hasThreadContext: !!note.discussion_id,
        triggerType: 'issue_comment'
      })
    };
  } else if (isMRComment) {
    const mergeRequest = noteData.merge_request;
    
    // Get enhanced context for MR comments
    const enhancedContext = await enhanceMRCommentContext(noteData, credentials);
    
    noteContext = {
      ...baseContext,
      PROCESSING_MODE: 'mr_comment',
      MR_IID: mergeRequest.iid.toString(),
      MR_TITLE: mergeRequest.title,
      MR_DESCRIPTION: mergeRequest.description || '',
      SOURCE_BRANCH: mergeRequest.source_branch,
      TARGET_BRANCH: mergeRequest.target_branch,
      
      // Enhanced file/line context
      ...(enhancedContext.fileContext && {
        FILE_PATH: enhancedContext.fileContext.filePath,
        LINE_NUMBER: enhancedContext.fileContext.lineNumber.toString(),
        BASE_SHA: enhancedContext.fileContext.baseSha,
        HEAD_SHA: enhancedContext.fileContext.headSha,
        CODE_CONTEXT: enhancedContext.fileContext.codeContext
      }),
      
      // Enhanced discussion context
      ...(enhancedContext.threadContext && {
        THREAD_CONTEXT: JSON.stringify(enhancedContext.threadContext)
      }),
      
      // Context-aware processing flag
      CONTEXT_AWARE_PROCESSING: 'true',
      ENHANCED_CONTEXT: JSON.stringify({
        hasFileContext: !!enhancedContext.fileContext,
        hasThreadContext: !!enhancedContext.threadContext,
        triggerType: 'mr_comment'
      })
    };
  } else {
    throw new Error(`Unsupported noteable type: ${note.noteable_type}`);
  }

  // Start Claude Code processing by calling the container
  logWithContext('GITLAB_ENHANCED_ROUTING', 'Starting enhanced Claude Code container processing', {
    containerName,
    noteId: note.id,
    processingMode: noteContext.PROCESSING_MODE,
    hasFileContext: !!noteContext.FILE_PATH,
    hasThreadContext: !!noteContext.THREAD_CONTEXT
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

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      throw new Error(`Container returned status ${response.status}: ${errorText}`);
    }

    // Parse container response
    const containerResponse: ContainerResponse = await response.json();
    
    logWithContext('GITLAB_ENHANCED_ROUTING', 'Enhanced container response parsed', {
      success: containerResponse.success,
      message: containerResponse.message,
      hasError: !!containerResponse.error
    });

  } catch (error) {
    logWithContext('GITLAB_ENHANCED_ROUTING', 'Failed to process enhanced Claude Code response', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

// Enhanced GitLab note event handler
export async function handleEnhancedGitLabNoteEvent(
  data: any, 
  env: any, 
  configDO: any
): Promise<Response> {
  const note = data.object_attributes;
  const project = data.project;
  const user = data.user;

  logWithContext('GITLAB_ENHANCED_NOTE_EVENT', 'Processing enhanced GitLab note event', {
    noteId: note?.id,
    noteableType: note?.noteable_type,
    project: project?.path_with_namespace,
    author: user?.username,
    isSystem: note?.system,
    isBot: isBot(user),
    hasPosition: !!note?.position
  });

  // Filter out system notes
  if (note.system) {
    return new Response('System note ignored', { status: 200 });
  }

  // Filter out bot comments
  if (isBot(user)) {
    return new Response('Bot comment ignored', { status: 200 });
  }

  // Check for @duo-agent mention
  if (!detectDuoAgentMention(note.note)) {
    return new Response('No @duo-agent mention found', { status: 200 });
  }

  // Only process Issue and MergeRequest comments
  if (note.noteable_type !== 'Issue' && note.noteable_type !== 'MergeRequest') {
    return new Response('Unsupported noteable type', { status: 200 });
  }

  try {
    // Route to enhanced Claude Code container for processing
    await routeToEnhancedClaudeCodeContainer(data, env, configDO);
    return new Response('Enhanced GitLab note processed', { status: 200 });

  } catch (error) {
    logWithContext('GITLAB_ENHANCED_NOTE_EVENT', 'Failed to process enhanced GitLab note', {
      error: error instanceof Error ? error.message : String(error),
      noteId: note?.id
    });
    return new Response('Failed to process enhanced note', { status: 500 });
  }
}