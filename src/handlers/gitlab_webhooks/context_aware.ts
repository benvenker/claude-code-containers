// Context-aware processing for GitLab webhooks
// This module enhances the existing GitLab webhook processing with intelligent context extraction

// Types for enhanced context
interface FileLineContext {
  filePath: string;
  lineNumber: number;
  baseSha: string;
  headSha: string;
  codeContext: string;
}

interface DiscussionThreadContext {
  discussionId: string;
  threadComments: Array<{
    author: string;
    body: string;
    created_at?: string;
  }>;
  totalComments: number;
}

interface ContextAwareResponse {
  triggerType: string;
  fileContext?: FileLineContext;
  threadContext?: DiscussionThreadContext;
  userPrompt: string;
  response: string;
}

interface EnhancedMRContext {
  fileContext: FileLineContext | null;
  threadContext: DiscussionThreadContext | null;
}

// Extract file/line context from MR comment position data
export async function extractFileLineContext(
  positionData: any,
  configDO: any
): Promise<FileLineContext | null> {
  if (!positionData) {
    return null;
  }

  // Extract position information
  const filePath = positionData.new_path || positionData.old_path;
  const lineNumber = positionData.new_line || positionData.old_line;
  const baseSha = positionData.base_sha;
  const headSha = positionData.head_sha;

  // For now, return mock code context
  // In a real implementation, this would fetch code from GitLab API
  const codeContext = 'function authenticate() { /* ... */ }';

  return {
    filePath,
    lineNumber,
    baseSha,
    headSha,
    codeContext
  };
}

// Extract discussion thread context from GitLab API
export async function extractDiscussionThreadContext(
  discussionId: string | null,
  noteableIid: number,
  noteableType: string,
  configDO: any
): Promise<DiscussionThreadContext | null> {
  if (!discussionId) {
    return null;
  }

  // For now, return mock discussion context
  // In a real implementation, this would fetch discussion from GitLab API
  const threadComments = [
    { author: 'user1', body: 'Initial comment' },
    { author: 'user2', body: 'Follow-up question' }
  ];

  return {
    discussionId,
    threadComments,
    totalComments: threadComments.length
  };
}

// Format context-aware response based on trigger type and available context
export function formatContextAwareResponse(context: ContextAwareResponse): string {
  let response = '';

  // Add file/line context for MR comments
  if (context.triggerType === 'mr_comment' && context.fileContext) {
    response += `## Code Review for ${context.fileContext.filePath}:${context.fileContext.lineNumber}\n\n`;
    response += '```javascript\n';
    response += context.fileContext.codeContext;
    response += '\n```\n\n';
  }

  // Add discussion context for threaded comments
  if (context.threadContext) {
    response += '## Discussion Context\n\n';
    for (const comment of context.threadContext.threadComments) {
      response += `**${comment.author}:** ${comment.body}\n\n`;
    }
  }

  // Add main response
  response += context.response;

  return response;
}

// Enhance MR comment context with file/line and discussion data
export async function enhanceMRCommentContext(
  noteData: any,
  configDO: any
): Promise<EnhancedMRContext> {
  const note = noteData.object_attributes;
  const mergeRequest = noteData.merge_request;

  // Extract file/line context from position data
  const fileContext = await extractFileLineContext(note.position, configDO);

  // Extract discussion thread context
  const threadContext = await extractDiscussionThreadContext(
    note.discussion_id,
    mergeRequest.iid,
    'MergeRequest',
    configDO
  );

  return {
    fileContext,
    threadContext
  };
}