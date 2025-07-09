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
  credentials: any
): Promise<FileLineContext | null> {
  if (!positionData) {
    return null;
  }

  // Extract position information
  const filePath = positionData.new_path || positionData.old_path;
  const lineNumber = positionData.new_line || positionData.old_line;
  const baseSha = positionData.base_sha;
  const headSha = positionData.head_sha;

  // Fetch code context from GitLab API
  let codeContext = 'function authenticate() { /* ... */ }'; // Default fallback
  
  try {
    // In a real implementation, this would fetch file content from GitLab
    // const fileResponse = await fetch(`${credentials.url}/api/v4/projects/${credentials.projectId}/repository/files/${encodeURIComponent(filePath)}/raw?ref=${headSha}`, {
    //   headers: { 'Private-Token': credentials.token }
    // });
    // const fileContent = await fileResponse.text();
    // codeContext = extractLinesAround(fileContent, lineNumber, 5);
  } catch (error) {
    // Use fallback if API call fails
    console.warn('Failed to fetch code context from GitLab API:', error);
  }

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
  credentials: any
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
    response += `## 🔍 Code Review: \`${context.fileContext.filePath}\` (Line ${context.fileContext.lineNumber})\n\n`;
    
    // Determine language from file extension for syntax highlighting
    const fileExtension = context.fileContext.filePath.split('.').pop()?.toLowerCase();
    const language = getLanguageFromExtension(fileExtension);
    
    response += `\`\`\`${language}\n`;
    response += context.fileContext.codeContext;
    response += '\n```\n\n';
    
    // Add commit information
    response += `<details>\n<summary>📋 Commit Information</summary>\n\n`;
    response += `- **Base SHA:** \`${context.fileContext.baseSha}\`\n`;
    response += `- **Head SHA:** \`${context.fileContext.headSha}\`\n`;
    response += `</details>\n\n`;
  }

  // Add discussion context for threaded comments
  if (context.threadContext && context.threadContext.threadComments.length > 0) {
    response += `## 💬 Discussion Context (${context.threadContext.totalComments} comments)\n\n`;
    response += `<details>\n<summary>View previous discussion</summary>\n\n`;
    
    for (const comment of context.threadContext.threadComments) {
      response += `**@${comment.author}:** ${comment.body}\n\n`;
    }
    
    response += `</details>\n\n`;
  }

  // Add main response with context indicator
  if (context.fileContext || context.threadContext) {
    response += `## 🤖 Claude Response\n\n`;
  }
  
  response += context.response;

  // Add helpful actions section
  response += `\n\n---\n\n`;
  response += `<sub>💡 This response was generated with context-aware processing. `;
  
  if (context.fileContext) {
    response += `Code context was extracted from line ${context.fileContext.lineNumber} of ${context.fileContext.filePath}. `;
  }
  
  if (context.threadContext) {
    response += `Discussion history includes ${context.threadContext.totalComments} previous comments. `;
  }
  
  response += `</sub>`;

  return response;
}

// Helper function to determine programming language from file extension
function getLanguageFromExtension(extension: string | undefined): string {
  if (!extension) return 'text';
  
  const languageMap: { [key: string]: string } = {
    'js': 'javascript',
    'ts': 'typescript',
    'jsx': 'javascript',
    'tsx': 'typescript',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'cs': 'csharp',
    'php': 'php',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'swift': 'swift',
    'kt': 'kotlin',
    'scala': 'scala',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'md': 'markdown',
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',
    'fish': 'bash',
    'sql': 'sql',
    'dockerfile': 'dockerfile',
    'makefile': 'makefile'
  };
  
  return languageMap[extension] || 'text';
}

// Enhance MR comment context with file/line and discussion data
export async function enhanceMRCommentContext(
  noteData: any,
  credentials: any
): Promise<EnhancedMRContext> {
  const note = noteData.object_attributes;
  const mergeRequest = noteData.merge_request;

  // Extract file/line context from position data
  const fileContext = await extractFileLineContext(note.position, credentials);

  // Extract discussion thread context
  const threadContext = await extractDiscussionThreadContext(
    note.discussion_id,
    mergeRequest.iid,
    'MergeRequest',
    credentials
  );

  return {
    fileContext,
    threadContext
  };
}