import * as http from 'http';
import { promises as fs } from 'fs';
import { query, type SDKMessage } from '@anthropic-ai/claude-code';
import simpleGit from 'simple-git';
import * as path from 'path';
import { spawn } from 'child_process';
import { ContainerGitHubClient } from './github_client.js';
import { GitLabClient } from './gitlab_client.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;

// Simplified container response interface
interface ContainerResponse {
  success: boolean;
  message: string;
  error?: string;
}

// Environment variables
const MESSAGE = process.env.MESSAGE || 'Hello from Claude Code Container';
const INSTANCE_ID = process.env.CLOUDFLARE_DEPLOYMENT_ID || 'unknown';

// Types
interface IssueContext {
  issueId: string;
  issueNumber: string;
  title: string;
  description: string;
  labels: string[];
  repositoryUrl: string;
  repositoryName: string;
  author: string;
}

// GitLab context interfaces
interface GitLabIssueContext {
  issueIid: number;
  issueTitle: string;
  issueDescription: string;
  projectNamespace: string;
  gitCloneUrl: string;
  authorUsername: string;
}

interface GitLabCommentContext {
  userPrompt: string;
  commentId: string;
  discussionId?: string;
  issueIid?: number;
  issueTitle?: string;
  mrIid?: number;
  mrTitle?: string;
  projectNamespace: string;
  authorUsername: string;
}

interface GitLabMRContext {
  userPrompt: string;
  mrIid: number;
  mrTitle: string;
  mrDescription: string;
  sourceBranch: string;
  targetBranch: string;
  projectNamespace: string;
  filePath?: string;
  lineNumber?: number;
}

interface HealthStatus {
  status: string;
  message: string;
  instanceId: string;
  timestamp: string;
  claudeCodeAvailable: boolean;
  githubTokenAvailable: boolean;
}



// Enhanced logging utility with context
function logWithContext(context: string, message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${context}] ${message}`;

  if (data) {
    console.log(logMessage, JSON.stringify(data, null, 2));
  } else {
    console.log(logMessage);
  }
}

// GitLab processing mode detection
export function detectProcessingMode(): string {
  // Check for GitLab environment variables
  if (process.env.GITLAB_URL && process.env.PROCESSING_MODE) {
    const mode = process.env.PROCESSING_MODE;
    switch (mode) {
      case 'issue':
        return 'gitlab_issue';
      case 'issue_comment':
        return 'gitlab_issue_comment';
      case 'mr_comment':
        return 'gitlab_mr_comment';
      case 'mr_creation':
        return 'gitlab_mr_creation';
    }
  }
  
  // Fallback to GitHub mode
  return 'github_issue';
}

// GitLab context validation
export function validateGitLabContext(): boolean {
  const mode = process.env.PROCESSING_MODE;
  
  // Basic required variables for all GitLab modes
  if (!process.env.GITLAB_URL || !process.env.GITLAB_TOKEN || !process.env.GITLAB_PROJECT_ID) {
    return false;
  }
  
  // Mode-specific validation
  switch (mode) {
    case 'issue':
      return !!(process.env.ISSUE_IID && process.env.ISSUE_TITLE && process.env.PROJECT_NAMESPACE);
    case 'issue_comment':
    case 'mr_comment':
      return !!(process.env.USER_PROMPT && process.env.COMMENT_ID);
    case 'mr_creation':
      return !!(process.env.MR_IID && process.env.USER_PROMPT);
    default:
      return false;
  }
}

// GitLab context formatters
export function formatGitLabIssueContext(context: GitLabIssueContext): string {
  return `
You are working on GitLab issue #${context.issueIid}: "${context.issueTitle}"

Project: ${context.projectNamespace}

Issue Description:
${context.issueDescription}

Author: ${context.authorUsername}

The repository has been cloned to your current working directory. Please:
1. Explore the codebase to understand the structure and relevant files
2. Analyze the issue requirements thoroughly
3. Implement a solution that addresses the issue
4. Write appropriate tests if needed
5. Ensure code quality and consistency with existing patterns

Work step by step and provide clear explanations of your approach.
`;
}

export function formatGitLabCommentContext(context: GitLabCommentContext): string {
  return `
You are responding to a @duo-agent mention in a GitLab comment.

User's request: ${context.userPrompt}

${context.issueIid ? `Context: GitLab issue #${context.issueIid} - ${context.issueTitle}` : ''}
${context.mrIid ? `Context: GitLab merge request !${context.mrIid} - ${context.mrTitle}` : ''}

Project: ${context.projectNamespace}
Author: ${context.authorUsername}

Please address the user's request directly and provide helpful assistance.
`;
}

export function formatGitLabMRContext(context: GitLabMRContext): string {
  return `
You are working on GitLab merge request !${context.mrIid}: "${context.mrTitle}"

MR Description:
${context.mrDescription}

User's request: ${context.userPrompt}

Branches: ${context.sourceBranch} → ${context.targetBranch}
Project: ${context.projectNamespace}

${context.filePath ? `Code location: ${context.filePath}:${context.lineNumber}` : ''}

Please address the user's request in the context of this merge request.
`;
}

// GitLab mode processing dispatcher
async function processGitLabMode(mode: string): Promise<ContainerResponse> {
  logWithContext('GITLAB_PROCESSOR', 'Processing GitLab mode', { mode });

  switch (mode) {
    case 'gitlab_issue':
      return await processGitLabIssue();
    case 'gitlab_issue_comment':
      return await processGitLabIssueComment();
    case 'gitlab_mr_comment':
      return await processGitLabMRComment();
    case 'gitlab_mr_creation':
      return await processGitLabMRCreation();
    default:
      throw new Error(`Unsupported GitLab processing mode: ${mode}`);
  }
}

// GitLab issue processing (similar to GitHub issue processing)
async function processGitLabIssue(): Promise<ContainerResponse> {
  logWithContext('GITLAB_PROCESSOR', 'Processing GitLab issue');

  try {
    // Extract issue context from environment
    const issueContext: GitLabIssueContext = {
      issueIid: parseInt(process.env.ISSUE_IID!),
      issueTitle: process.env.ISSUE_TITLE!,
      issueDescription: process.env.ISSUE_DESCRIPTION || '',
      projectNamespace: process.env.PROJECT_NAMESPACE!,
      gitCloneUrl: process.env.GIT_CLONE_URL!,
      authorUsername: process.env.AUTHOR_USERNAME || 'unknown'
    };

    logWithContext('GITLAB_PROCESSOR', 'GitLab issue context prepared', {
      issueIid: issueContext.issueIid,
      projectNamespace: issueContext.projectNamespace
    });

    // Initialize GitLab client
    const gitlabClient = new GitLabClient({
      gitlabUrl: process.env.GITLAB_URL!,
      projectId: process.env.GITLAB_PROJECT_ID!,
      token: process.env.GITLAB_TOKEN!
    });

    // Setup workspace (adapted from GitHub version)
    const workspaceDir = await setupGitLabWorkspace(issueContext.gitCloneUrl, `issue-${issueContext.issueIid}`);

    // Prepare Claude prompt
    const prompt = formatGitLabIssueContext(issueContext);
    
    // Execute Claude Code (similar to GitHub flow)
    const claudeResult = await executeClaude(prompt, workspaceDir);

    // Check for changes and handle response
    const hasChanges = await detectGitChanges(workspaceDir);

    if (hasChanges) {
      // Create MR for issue fix
      const branchName = `claude-code/issue-${issueContext.issueIid}`;
      await createFeatureBranchCommitAndPush(workspaceDir, branchName, `Fix issue #${issueContext.issueIid}: ${issueContext.issueTitle}`);
      
      // TODO: Create GitLab MR via API
      return {
        success: true,
        message: `Created branch ${branchName} with issue fix`
      };
    } else {
      // Post comment to issue
      // TODO: Post comment via GitLab API
      return {
        success: true,
        message: `Posted analysis comment to issue #${issueContext.issueIid}`
      };
    }

  } catch (error) {
    logWithContext('GITLAB_PROCESSOR', 'Error processing GitLab issue', {
      error: (error as Error).message
    });
    return {
      success: false,
      message: 'Failed to process GitLab issue',
      error: (error as Error).message
    };
  }
}

// GitLab comment processing
async function processGitLabIssueComment(): Promise<ContainerResponse> {
  logWithContext('GITLAB_PROCESSOR', 'Processing GitLab issue comment');

  try {
    const commentContext: GitLabCommentContext = {
      userPrompt: process.env.USER_PROMPT!,
      commentId: process.env.COMMENT_ID!,
      discussionId: process.env.DISCUSSION_ID,
      issueIid: process.env.ISSUE_IID ? parseInt(process.env.ISSUE_IID) : undefined,
      issueTitle: process.env.ISSUE_TITLE,
      projectNamespace: process.env.PROJECT_NAMESPACE!,
      authorUsername: process.env.AUTHOR_USERNAME || 'unknown'
    };

    // Setup workspace for context
    const workspaceDir = await setupGitLabWorkspace(process.env.GIT_CLONE_URL!, `comment-${commentContext.commentId}`);

    // Prepare Claude prompt
    const prompt = formatGitLabCommentContext(commentContext);
    
    // Execute Claude Code
    const claudeResult = await executeClaude(prompt, workspaceDir);

    // TODO: Reply to comment via GitLab API
    return {
      success: true,
      message: `Replied to comment on issue #${commentContext.issueIid}`
    };

  } catch (error) {
    return {
      success: false,
      message: 'Failed to process GitLab comment',
      error: (error as Error).message
    };
  }
}

// GitLab MR comment processing
async function processGitLabMRComment(): Promise<ContainerResponse> {
  logWithContext('GITLAB_PROCESSOR', 'Processing GitLab MR comment');

  try {
    const mrContext: GitLabMRContext = {
      userPrompt: process.env.USER_PROMPT!,
      mrIid: parseInt(process.env.MR_IID!),
      mrTitle: process.env.MR_TITLE || '',
      mrDescription: process.env.MR_DESCRIPTION || '',
      sourceBranch: process.env.SOURCE_BRANCH!,
      targetBranch: process.env.TARGET_BRANCH!,
      projectNamespace: process.env.PROJECT_NAMESPACE!,
      filePath: process.env.FILE_PATH,
      lineNumber: process.env.LINE_NUMBER ? parseInt(process.env.LINE_NUMBER) : undefined
    };

    // Setup workspace on source branch
    const workspaceDir = await setupGitLabWorkspace(process.env.GIT_CLONE_URL!, `mr-${mrContext.mrIid}`, mrContext.sourceBranch);

    // Prepare Claude prompt
    const prompt = formatGitLabMRContext(mrContext);
    
    // Execute Claude Code
    const claudeResult = await executeClaude(prompt, workspaceDir);

    // Check for changes and commit if needed
    const hasChanges = await detectGitChanges(workspaceDir);
    if (hasChanges) {
      await createFeatureBranchCommitAndPush(workspaceDir, mrContext.sourceBranch, 'Update based on MR comment feedback');
    }

    // TODO: Reply to discussion via GitLab API
    return {
      success: true,
      message: `Replied to MR !${mrContext.mrIid} comment`
    };

  } catch (error) {
    return {
      success: false,
      message: 'Failed to process GitLab MR comment',
      error: (error as Error).message
    };
  }
}

// GitLab MR creation processing
async function processGitLabMRCreation(): Promise<ContainerResponse> {
  logWithContext('GITLAB_PROCESSOR', 'Processing GitLab MR creation');

  // Similar to MR comment but focused on implementing MR requirements
  // TODO: Implement MR creation processing
  return {
    success: true,
    message: 'GitLab MR creation processing not fully implemented yet'
  };
}

// Configure GitLab CLI with authentication token
async function configureGitLabCLI(token: string): Promise<void> {
  try {
    // Set GitLab host (default to gitlab.com if not specified)
    const gitlabHost = process.env.GITLAB_URL || 'https://gitlab.com';
    
    logWithContext('GITLAB_CLI', 'Configuring GitLab CLI', { host: gitlabHost });

    // Configure glab using environment variables
    // The GitLab CLI respects these environment variables
    process.env.GITLAB_TOKEN = token;
    process.env.GITLAB_HOST = gitlabHost;
    
    // Verify glab is available
    await new Promise<void>((resolve, reject) => {
      const glabProcess = spawn('glab', ['--version'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      glabProcess.on('close', (code: number) => {
        if (code === 0) {
          logWithContext('GITLAB_CLI', 'GitLab CLI is available and configured');
          resolve();
        } else {
          reject(new Error('GitLab CLI (glab) is not available'));
        }
      });
      
      glabProcess.on('error', (error: Error) => {
        reject(new Error(`Failed to run GitLab CLI: ${error.message}`));
      });
    });
  } catch (error) {
    logWithContext('GITLAB_CLI', 'Failed to configure GitLab CLI', { error });
    // Non-fatal: GitLab CLI is optional, container can still function
  }
}

// GitLab workspace setup (adapted from GitHub version)
async function setupGitLabWorkspace(gitCloneUrl: string, workspaceId: string, branch?: string): Promise<string> {
  const workspaceDir = `/tmp/workspace/${workspaceId}`;

  logWithContext('GITLAB_WORKSPACE', 'Setting up GitLab workspace', {
    workspaceDir,
    gitCloneUrl,
    branch
  });

  try {
    // Create parent workspace directory
    await fs.mkdir(path.dirname(workspaceDir), { recursive: true });
    
    // Get GitLab token for authenticated cloning
    const gitlabToken = process.env.GITLAB_TOKEN;
    if (!gitlabToken) {
      throw new Error('GitLab token not available for cloning');
    }

    // Configure GitLab CLI (glab) with authentication
    await configureGitLabCLI(gitlabToken);

    // Construct authenticated clone URL for GitLab
    let authenticatedUrl = gitCloneUrl;
    if (gitCloneUrl.includes('gitlab.com') || gitCloneUrl.includes(process.env.GITLAB_URL!)) {
      // Replace https://gitlab.com/ with https://oauth2:token@gitlab.com/
      authenticatedUrl = gitCloneUrl.replace(
        /https:\/\/([^\/]+)\//,
        `https://oauth2:${gitlabToken}@$1/`
      );
    }

    logWithContext('GITLAB_WORKSPACE', 'Starting GitLab git clone');

    // Clone repository using git command
    await new Promise<void>((resolve, reject) => {
      const gitProcess = spawn('git', ['clone', authenticatedUrl, workspaceDir], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      gitProcess.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      gitProcess.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      gitProcess.on('close', (code: number) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Git clone failed with code ${code}: ${stderr}`));
        }
      });
    });

    // Initialize git workspace
    const git = simpleGit(workspaceDir);
    await git.addConfig('user.name', 'Claude Code Bot');
    await git.addConfig('user.email', 'claude-code@anthropic.com');

    // Checkout specific branch if requested
    if (branch && branch !== 'main' && branch !== 'master') {
      try {
        await git.checkout(branch);
        logWithContext('GITLAB_WORKSPACE', 'Checked out branch', { branch });
      } catch (error) {
        logWithContext('GITLAB_WORKSPACE', 'Failed to checkout branch, staying on default', { 
          branch, 
          error: (error as Error).message 
        });
      }
    }

    logWithContext('GITLAB_WORKSPACE', 'GitLab workspace setup completed', { workspaceDir });
    return workspaceDir;

  } catch (error) {
    logWithContext('GITLAB_WORKSPACE', 'Error setting up GitLab workspace', {
      error: (error as Error).message,
      gitCloneUrl,
      workspaceDir
    });
    throw error;
  }
}

// Execute Claude Code (extracted from existing GitHub flow)
async function executeClaude(prompt: string, workspaceDir: string): Promise<any> {
  logWithContext('CLAUDE_EXECUTOR', 'Starting Claude Code execution', {
    workspaceDir,
    promptLength: prompt.length
  });

  const results: SDKMessage[] = [];
  let turnCount = 0;

  try {
    const originalCwd = process.cwd();
    process.chdir(workspaceDir);

    logWithContext('CLAUDE_EXECUTOR', 'Changed working directory for Claude Code', {
      originalCwd,
      newCwd: workspaceDir
    });

    try {
      for await (const message of query({
        prompt,
        options: { permissionMode: 'bypassPermissions' }
      })) {
        turnCount++;
        results.push(message);

        logWithContext('CLAUDE_EXECUTOR', `Claude turn ${turnCount} completed`, {
          type: message.type,
          turnCount
        });
      }

      logWithContext('CLAUDE_EXECUTOR', 'Claude Code execution completed', {
        totalTurns: turnCount,
        resultsCount: results.length
      });

      return {
        results,
        turnCount,
        response: results.length > 0 ? getMessageText(results[results.length - 1]) : ''
      };

    } finally {
      // Always restore the original working directory
      process.chdir(originalCwd);
      logWithContext('CLAUDE_EXECUTOR', 'Restored original working directory', { originalCwd });
    }

  } catch (error) {
    logWithContext('CLAUDE_EXECUTOR', 'Error during Claude Code execution', {
      error: (error as Error).message,
      turnCount,
      resultsCount: results.length
    });
    throw error;
  }
}

// Basic health check handler
async function healthHandler(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  logWithContext('HEALTH', 'Health check requested');

  const response: HealthStatus = {
    status: 'healthy',
    message: MESSAGE,
    instanceId: INSTANCE_ID,
    timestamp: new Date().toISOString(),
    claudeCodeAvailable: !!process.env.ANTHROPIC_API_KEY,
    githubTokenAvailable: !!process.env.GITHUB_TOKEN
  };

  logWithContext('HEALTH', 'Health check response', {
    status: response.status,
    claudeCodeAvailable: response.claudeCodeAvailable,
    githubTokenAvailable: response.githubTokenAvailable,
    instanceId: response.instanceId
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response));
}

// Error handler for testing
async function errorHandler(_req: http.IncomingMessage, _res: http.ServerResponse): Promise<void> {
  throw new Error('This is a test error from the container');
}

// Setup isolated workspace for issue processing using proper git clone
async function setupWorkspace(repositoryUrl: string, issueNumber: string): Promise<string> {
  const workspaceDir = `/tmp/workspace/issue-${issueNumber}`;

  logWithContext('WORKSPACE', 'Setting up workspace with git clone', {
    workspaceDir,
    repositoryUrl,
    issueNumber
  });

  try {
    // Create parent workspace directory
    await fs.mkdir(path.dirname(workspaceDir), { recursive: true });
    logWithContext('WORKSPACE', 'Parent workspace directory created');

    const cloneStartTime = Date.now();

    // Get GitHub token for authenticated cloning
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error('GitHub token not available for cloning');
    }

    // Construct authenticated clone URL
    const authenticatedUrl = repositoryUrl.replace(
      'https://github.com/',
      `https://x-access-token:${githubToken}@github.com/`
    );

    logWithContext('WORKSPACE', 'Starting git clone');

    // Clone repository using git command
    await new Promise<void>((resolve, reject) => {
      const gitProcess = spawn('git', ['clone', authenticatedUrl, workspaceDir], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      gitProcess.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      gitProcess.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      gitProcess.on('close', (code: number) => {
        if (code === 0) {
          logWithContext('WORKSPACE', 'Git clone completed successfully', {
            stdout: stdout.substring(0, 200),
            stderr: stderr.substring(0, 200)
          });
          resolve();
        } else {
          logWithContext('WORKSPACE', 'Git clone failed', {
            code,
            stdout,
            stderr
          });
          reject(new Error(`Git clone failed with code ${code}: ${stderr}`));
        }
      });
    });

    const cloneTime = Date.now() - cloneStartTime;

    // Initialize git workspace for our workflow
    await initializeGitWorkspace(workspaceDir);

    logWithContext('WORKSPACE', 'Git repository cloned and configured successfully', {
      cloneTimeMs: cloneTime
    });

    return workspaceDir;
  } catch (error) {
    logWithContext('WORKSPACE', 'Error setting up workspace', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      repositoryUrl,
      workspaceDir
    });
    throw error;
  }
}

// Initialize git workspace for proper developer workflow
async function initializeGitWorkspace(workspaceDir: string): Promise<void> {
  logWithContext('GIT_WORKSPACE', 'Configuring git workspace for development', { workspaceDir });

  const git = simpleGit(workspaceDir);

  try {
    // Configure git user (this is already a cloned repo, so no need to init)
    await git.addConfig('user.name', 'Claude Code Bot');
    await git.addConfig('user.email', 'claude-code@anthropic.com');

    // Fetch latest changes to ensure we're up to date
    await git.fetch('origin');

    // Get current branch info
    const status = await git.status();
    const currentBranch = status.current;

    logWithContext('GIT_WORKSPACE', 'Git workspace configured', {
      currentBranch,
      isClean: status.isClean(),
      ahead: status.ahead,
      behind: status.behind
    });

    // Ensure we're on the latest default branch
    if (status.behind > 0) {
      logWithContext('GIT_WORKSPACE', 'Pulling latest changes from remote');
      await git.pull('origin', currentBranch || 'main');
    }

  } catch (error) {
    logWithContext('GIT_WORKSPACE', 'Error configuring git workspace', {
      error: (error as Error).message
    });
    throw error;
  }
}

// Detect if there are any git changes from the default branch
async function detectGitChanges(workspaceDir: string): Promise<boolean> {
  logWithContext('GIT_WORKSPACE', 'Detecting git changes', { workspaceDir });

  const git = simpleGit(workspaceDir);

  try {
    const status = await git.status();
    const hasChanges = !status.isClean();

    logWithContext('GIT_WORKSPACE', 'Git change detection result', {
      hasChanges,
      isClean: status.isClean(),
      files: status.files.map(f => ({ file: f.path, status: f.working_dir })),
      ahead: status.ahead,
      behind: status.behind
    });

    return hasChanges;
  } catch (error) {
    logWithContext('GIT_WORKSPACE', 'Error detecting git changes', {
      error: (error as Error).message
    });
    return false;
  }
}

// Create feature branch, commit changes, and push to remote
async function createFeatureBranchCommitAndPush(workspaceDir: string, branchName: string, message: string): Promise<string> {
  logWithContext('GIT_WORKSPACE', 'Creating feature branch, committing, and pushing changes', {
    workspaceDir,
    branchName,
    message
  });

  const git = simpleGit(workspaceDir);

  try {
    // Create and checkout new feature branch
    await git.checkoutLocalBranch(branchName);
    logWithContext('GIT_WORKSPACE', 'Feature branch created and checked out', { branchName });

    // Add all changes
    await git.add('.');

    // Commit changes
    const result = await git.commit(message);
    const commitSha = result.commit;

    logWithContext('GIT_WORKSPACE', 'Changes committed to feature branch', {
      commitSha,
      branchName,
      summary: result.summary
    });

    // Push branch to remote
    await git.push('origin', branchName, ['--set-upstream']);
    logWithContext('GIT_WORKSPACE', 'Branch pushed to remote successfully', { branchName });

    return commitSha;
  } catch (error) {
    logWithContext('GIT_WORKSPACE', 'Error creating branch, committing, or pushing changes', {
      error: (error as Error).message,
      branchName
    });
    throw error;
  }
}

// Read PR summary from .claude-pr-summary.md file
async function readPRSummary(workspaceDir: string): Promise<string | null> {
  const summaryPath = path.join(workspaceDir, '.claude-pr-summary.md');

  try {
    const content = await fs.readFile(summaryPath, 'utf8');
    logWithContext('GIT_WORKSPACE', 'PR summary read successfully', {
      contentLength: content.length
    });
    return content.trim();
  } catch (error) {
    logWithContext('GIT_WORKSPACE', 'No PR summary file found or error reading', {
      summaryPath,
      error: (error as Error).message
    });
    return null;
  }
}

// Prepare prompt for Claude Code
function prepareClaudePrompt(issueContext: IssueContext): string {
  return `
You are working on GitHub issue #${issueContext.issueNumber}: "${issueContext.title}"

Issue Description:
${issueContext.description}

Labels: ${issueContext.labels.join(', ')}
Author: ${issueContext.author}

The repository has been cloned to your current working directory. Please:
1. Explore the codebase to understand the structure and relevant files
2. Analyze the issue requirements thoroughly
3. Implement a solution that addresses the issue
4. Write appropriate tests if needed
5. Ensure code quality and consistency with existing patterns

**IMPORTANT: If you make any file changes, please create a file called '.claude-pr-summary.md' in the root directory with a concise summary (1-3 sentences) of what changes you made and why. This will be used for the pull request description.**

Work step by step and provide clear explanations of your approach.
`;
}


// Process issue with Claude Code and handle GitHub operations directly
async function processIssue(issueContext: IssueContext, githubToken: string): Promise<ContainerResponse> {
  logWithContext('ISSUE_PROCESSOR', 'Starting issue processing', {
    repositoryName: issueContext.repositoryName,
    issueNumber: issueContext.issueNumber,
    title: issueContext.title
  });

  const results: SDKMessage[] = [];
  let turnCount = 0;

  try {
    // 1. Setup workspace with repository clone
    const workspaceDir = await setupWorkspace(issueContext.repositoryUrl, issueContext.issueNumber);

    logWithContext('ISSUE_PROCESSOR', 'Workspace setup completed', {
      workspaceDir
    });

    // 2. Initialize GitHub client
    const [owner, repo] = issueContext.repositoryName.split('/');
    const githubClient = new ContainerGitHubClient(githubToken, owner, repo);
    
    logWithContext('ISSUE_PROCESSOR', 'GitHub client initialized', {
      owner,
      repo
    });

    // 3. Prepare prompt for Claude Code
    const prompt = prepareClaudePrompt(issueContext);
    logWithContext('ISSUE_PROCESSOR', 'Claude prompt prepared', {
      promptLength: prompt.length
    });

    // 4. Query Claude Code in the workspace directory
    logWithContext('ISSUE_PROCESSOR', 'Starting Claude Code query');

    try {
      const claudeStartTime = Date.now();

      // Change working directory to the cloned repository
      const originalCwd = process.cwd();
      process.chdir(workspaceDir);

      logWithContext('CLAUDE_CODE', 'Changed working directory for Claude Code execution', {
        originalCwd,
        newCwd: workspaceDir
      });

      try {
        for await (const message of query({
          prompt,
          options: { permissionMode: 'bypassPermissions' }
        })) {
        turnCount++;
        results.push(message);

        // Log message details (message structure depends on SDK version)
        logWithContext('CLAUDE_CODE', `Turn ${turnCount} completed`, {
          type: message.type,
          messagePreview: JSON.stringify(message),
          turnCount,
        });
      }

      const claudeEndTime = Date.now();
      const claudeDuration = claudeEndTime - claudeStartTime;

      logWithContext('ISSUE_PROCESSOR', 'Claude Code query completed', {
        totalTurns: turnCount,
        duration: claudeDuration,
        resultsCount: results.length
      });

      // 5. Check for file changes using git
      const hasChanges = await detectGitChanges(workspaceDir);
      logWithContext('ISSUE_PROCESSOR', 'Change detection completed', { hasChanges });

      // 6. Get solution text from Claude Code
      let solution = '';
      if (results.length > 0) {
        const lastResult = results[results.length - 1];
        solution = getMessageText(lastResult);
      }

      if (hasChanges) {
        // Generate branch name
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace(/T/g, '-').split('.')[0];
        const branchName = `claude-code/issue-${issueContext.issueNumber}-${timestamp}`;
        
        // Create feature branch, commit changes, and push to remote
        const commitSha = await createFeatureBranchCommitAndPush(
          workspaceDir, 
          branchName,
          `Fix issue #${issueContext.issueNumber}: ${issueContext.title}`
        );
        
        logWithContext('ISSUE_PROCESSOR', 'Changes committed and pushed to feature branch', {
          commitSha,
          branchName
        });

        // Try to read PR summary
        const prSummary = await readPRSummary(workspaceDir);
        
        // Create pull request
        try {
          const repoInfo = await githubClient.getRepository();
          const prTitle = prSummary ? prSummary.split('\n')[0].trim() : `Fix issue #${issueContext.issueNumber}`;
          const prBody = generatePRBody(prSummary, solution, issueContext.issueNumber);
          
          const pullRequest = await githubClient.createPullRequest(
            prTitle,
            prBody,
            branchName,
            repoInfo.default_branch
          );
          
          logWithContext('ISSUE_PROCESSOR', 'Pull request created successfully', {
            prNumber: pullRequest.number,
            prUrl: pullRequest.html_url
          });

          // Post comment linking to the PR
          await githubClient.createComment(
            parseInt(issueContext.issueNumber),
            `🔧 I've created a pull request with a potential fix: ${pullRequest.html_url}\n\n${solution}\n\n---\n🤖 Generated with [Claude Code](https://claude.ai/code)`
          );

          return {
            success: true,
            message: `Pull request created successfully: ${pullRequest.html_url}`
          };
        } catch (prError) {
          logWithContext('ISSUE_PROCESSOR', 'Failed to create pull request, posting comment instead', {
            error: (prError as Error).message
          });
          
          // Fall back to posting a comment with the solution
          await githubClient.createComment(
            parseInt(issueContext.issueNumber),
            `${solution}\n\n---\n⚠️ **Note:** I attempted to create a pull request with code changes, but encountered an error: ${(prError as Error).message}\n\nThe solution above describes the changes that should be made.\n\n🤖 Generated with [Claude Code](https://claude.ai/code)`
          );

          return {
            success: true,
            message: 'Solution posted as comment (PR creation failed)'
          };
        }
      } else {
        // No file changes, just post solution as comment
        await githubClient.createComment(
          parseInt(issueContext.issueNumber),
          `${solution}\n\n---\n🤖 Generated with [Claude Code](https://claude.ai/code)`
        );

        return {
          success: true,
          message: 'Solution posted as comment (no file changes)'
        };
      }

      } catch (claudeError) {
        logWithContext('ISSUE_PROCESSOR', 'Error during Claude Code query', {
          error: (claudeError as Error).message,
          turnCount,
          resultsCount: results.length
        });
        throw claudeError;
      } finally {
        // Always restore the original working directory
        process.chdir(originalCwd);
        logWithContext('CLAUDE_CODE', 'Restored original working directory', { originalCwd });
      }

    } catch (outerError) {
      logWithContext('ISSUE_PROCESSOR', 'Error in Claude Code execution setup', {
        error: (outerError as Error).message,
        turnCount,
        resultsCount: results.length
      });
      throw outerError;
    }

  } catch (error) {
    logWithContext('ISSUE_PROCESSOR', 'Error processing issue', {
      error: (error as Error).message,
      repositoryName: issueContext.repositoryName,
      issueNumber: issueContext.issueNumber,
      turnCount,
      resultsCount: results.length
    });

    return {
      success: false,
      message: 'Failed to process issue',
      error: (error as Error).message
    };
  }
}

// Generate PR body from summary and solution
function generatePRBody(prSummary: string | null, _solution: string, issueNumber: string): string {
  let body = '';
  
  if (prSummary) {
    body = prSummary.trim();
  } else {
    body = 'Automated fix generated by Claude Code.';
  }
  
  // Add footer
  body += `\n\n---\nFixes #${issueNumber}\n\n🤖 This pull request was generated automatically by [Claude Code](https://claude.ai/code) in response to the issue above.`;
  
  return body;
}

// Main issue processing handler
async function processIssueHandler(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  logWithContext('ISSUE_HANDLER', 'Processing issue request');

  // Read request body to get environment variables if they're passed in the request
  let requestBody = '';
  for await (const chunk of req) {
    requestBody += chunk;
  }

  let issueContextFromRequest: any = {};
  if (requestBody) {
    try {
      issueContextFromRequest = JSON.parse(requestBody);
      logWithContext('ISSUE_HANDLER', 'Received issue context in request body', {
        hasAnthropicKey: !!issueContextFromRequest.ANTHROPIC_API_KEY,
        hasGithubToken: !!issueContextFromRequest.GITHUB_TOKEN,
        keysReceived: Object.keys(issueContextFromRequest)
      });

      // Set environment variables from request body if they exist
      if (issueContextFromRequest.ANTHROPIC_API_KEY) {
        process.env.ANTHROPIC_API_KEY = issueContextFromRequest.ANTHROPIC_API_KEY;
      }
      if (issueContextFromRequest.GITHUB_TOKEN) {
        process.env.GITHUB_TOKEN = issueContextFromRequest.GITHUB_TOKEN;
      }
      if (issueContextFromRequest.ISSUE_ID) {
        process.env.ISSUE_ID = issueContextFromRequest.ISSUE_ID;
      }
      if (issueContextFromRequest.ISSUE_NUMBER) {
        process.env.ISSUE_NUMBER = issueContextFromRequest.ISSUE_NUMBER;
      }
      if (issueContextFromRequest.ISSUE_TITLE) {
        process.env.ISSUE_TITLE = issueContextFromRequest.ISSUE_TITLE;
      }
      if (issueContextFromRequest.ISSUE_BODY) {
        process.env.ISSUE_BODY = issueContextFromRequest.ISSUE_BODY;
      }
      if (issueContextFromRequest.ISSUE_LABELS) {
        process.env.ISSUE_LABELS = issueContextFromRequest.ISSUE_LABELS;
      }
      if (issueContextFromRequest.REPOSITORY_URL) {
        process.env.REPOSITORY_URL = issueContextFromRequest.REPOSITORY_URL;
      }
      if (issueContextFromRequest.REPOSITORY_NAME) {
        process.env.REPOSITORY_NAME = issueContextFromRequest.REPOSITORY_NAME;
      }
      if (issueContextFromRequest.ISSUE_AUTHOR) {
        process.env.ISSUE_AUTHOR = issueContextFromRequest.ISSUE_AUTHOR;
      }

      logWithContext('ISSUE_HANDLER', 'Environment variables updated from request', {
        anthropicKeySet: !!process.env.ANTHROPIC_API_KEY,
        githubTokenSet: !!process.env.GITHUB_TOKEN,
        issueIdSet: !!process.env.ISSUE_ID
      });
    } catch (error) {
      logWithContext('ISSUE_HANDLER', 'Error parsing request body', {
        error: (error as Error).message,
        bodyLength: requestBody.length
      });
    }
  }

  // Check for API key (now potentially updated from request)
  if (!process.env.ANTHROPIC_API_KEY) {
    logWithContext('ISSUE_HANDLER', 'Missing Anthropic API key');
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY not provided' }));
    return;
  }

  if (!process.env.ISSUE_ID || !process.env.REPOSITORY_URL) {
    logWithContext('ISSUE_HANDLER', 'Missing issue context', {
      hasIssueId: !!process.env.ISSUE_ID,
      hasRepositoryUrl: !!process.env.REPOSITORY_URL
    });
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Issue context not provided' }));
    return;
  }

  const issueContext: IssueContext = {
    issueId: process.env.ISSUE_ID!,
    issueNumber: process.env.ISSUE_NUMBER!,
    title: process.env.ISSUE_TITLE!,
    description: process.env.ISSUE_BODY!,
    labels: process.env.ISSUE_LABELS ? JSON.parse(process.env.ISSUE_LABELS) : [],
    repositoryUrl: process.env.REPOSITORY_URL!,
    repositoryName: process.env.REPOSITORY_NAME!,
    author: process.env.ISSUE_AUTHOR!
  };

  logWithContext('ISSUE_HANDLER', 'Issue context prepared', {
    issueId: issueContext.issueId,
    issueNumber: issueContext.issueNumber,
    repository: issueContext.repositoryName,
    author: issueContext.author,
    labelsCount: issueContext.labels.length
  });

  // Process issue and return structured response
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error('GITHUB_TOKEN is required but not provided');
    }

    const containerResponse = await processIssue(issueContext, githubToken);

    logWithContext('ISSUE_HANDLER', 'Issue processing completed', {
      success: containerResponse.success,
      message: containerResponse.message,
      hasError: !!containerResponse.error
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(containerResponse));
  } catch (error) {
    logWithContext('ISSUE_HANDLER', 'Issue processing failed', {
      error: error instanceof Error ? error.message : String(error),
      issueId: issueContext.issueId
    });

    const errorResponse: ContainerResponse = {
      success: false,
      message: 'Failed to process issue',
      error: error instanceof Error ? error.message : String(error)
    };

    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(errorResponse));
  }
}

// GitLab processing handler
async function processGitLabHandler(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  logWithContext('GITLAB_HANDLER', 'Processing GitLab request');

  // Read request body to get environment variables
  let requestBody = '';
  for await (const chunk of req) {
    requestBody += chunk;
  }

  let gitlabContextFromRequest: any = {};
  if (requestBody) {
    try {
      gitlabContextFromRequest = JSON.parse(requestBody);
      logWithContext('GITLAB_HANDLER', 'Received GitLab context in request body', {
        hasAnthropicKey: !!gitlabContextFromRequest.ANTHROPIC_API_KEY,
        hasGitLabToken: !!gitlabContextFromRequest.GITLAB_TOKEN,
        processingMode: gitlabContextFromRequest.PROCESSING_MODE,
        keysReceived: Object.keys(gitlabContextFromRequest)
      });

      // Set environment variables from request body
      Object.keys(gitlabContextFromRequest).forEach(key => {
        if (gitlabContextFromRequest[key]) {
          process.env[key] = gitlabContextFromRequest[key];
        }
      });

    } catch (error) {
      logWithContext('GITLAB_HANDLER', 'Error parsing request body', {
        error: (error as Error).message,
        bodyLength: requestBody.length
      });
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON in request body' }));
      return;
    }
  }

  // Check for required API keys
  if (!process.env.ANTHROPIC_API_KEY) {
    logWithContext('GITLAB_HANDLER', 'Missing Anthropic API key');
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY not provided' }));
    return;
  }

  // Validate GitLab context
  if (!validateGitLabContext()) {
    logWithContext('GITLAB_HANDLER', 'Invalid GitLab context');
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid GitLab context' }));
    return;
  }

  // Process based on detected mode
  try {
    const mode = detectProcessingMode();
    logWithContext('GITLAB_HANDLER', 'Detected processing mode', { mode });

    const response = await processGitLabMode(mode);
    
    logWithContext('GITLAB_HANDLER', 'GitLab processing completed', {
      success: response.success,
      mode
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));

  } catch (error) {
    logWithContext('GITLAB_HANDLER', 'GitLab processing failed', {
      error: error instanceof Error ? error.message : String(error)
    });

    const errorResponse: ContainerResponse = {
      success: false,
      message: 'Failed to process GitLab request',
      error: error instanceof Error ? error.message : String(error)
    };

    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(errorResponse));
  }
}

// Route handler  
export async function requestHandler(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const { method, url } = req;
  const startTime = Date.now();

  logWithContext('REQUEST_HANDLER', 'Incoming request', {
    method,
    url,
    headers: req.headers,
    remoteAddress: req.socket.remoteAddress
  });

  try {
    if (url === '/' || url === '/container') {
      logWithContext('REQUEST_HANDLER', 'Routing to health handler');
      await healthHandler(req, res);
    } else if (url === '/error') {
      logWithContext('REQUEST_HANDLER', 'Routing to error handler');
      await errorHandler(req, res);
    } else if (url === '/process-issue') {
      logWithContext('REQUEST_HANDLER', 'Routing to process issue handler');
      await processIssueHandler(req, res);
    } else if (url === '/process-gitlab') {
      logWithContext('REQUEST_HANDLER', 'Routing to GitLab process handler');
      await processGitLabHandler(req, res);
    } else {
      logWithContext('REQUEST_HANDLER', 'Route not found', { url });
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }

    const processingTime = Date.now() - startTime;
    logWithContext('REQUEST_HANDLER', 'Request completed successfully', {
      method,
      url,
      processingTimeMs: processingTime
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;

    logWithContext('REQUEST_HANDLER', 'Request handler error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      method,
      url,
      processingTimeMs: processingTime
    });

    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Internal server error',
      message: (error as Error).message
    }));
  }
}

// Start server
const server = http.createServer(requestHandler);

server.listen(PORT, () => {
  const address = server.address();
  const host = typeof address === 'string' ? address : address?.address || 'unknown';
  const port = typeof address === 'string' ? PORT : address?.port || PORT;
  
  logWithContext('SERVER', 'Claude Code container server started', {
    port: port,
    host: host,
    address: address,
    pid: process.pid,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch
  });

  logWithContext('SERVER', 'Configuration check', {
    claudeCodeAvailable: !!process.env.ANTHROPIC_API_KEY,
    githubTokenAvailable: !!process.env.GITHUB_TOKEN,
    issueContext: !!process.env.ISSUE_ID,
    environment: {
      instanceId: INSTANCE_ID,
      message: MESSAGE,
      issueId: process.env.ISSUE_ID,
      repositoryName: process.env.REPOSITORY_NAME
    }
  });
});

// Error handling for server
server.on('error', (error) => {
  logWithContext('SERVER', 'Server error', {
    error: error.message,
    code: (error as any).code,
    stack: error.stack
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logWithContext('SERVER', 'Received SIGTERM, shutting down gracefully');

  server.close(() => {
    logWithContext('SERVER', 'Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logWithContext('SERVER', 'Received SIGINT, shutting down gracefully');

  server.close(() => {
    logWithContext('SERVER', 'Server closed successfully');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logWithContext('SERVER', 'Uncaught exception', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logWithContext('SERVER', 'Unhandled promise rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: String(promise)
  });
});

// Helper function to extract text from SDK message
function getMessageText(message: SDKMessage): string {
  // Handle different message types from the SDK
  if ('content' in message && typeof message.content === 'string') {
    return message.content;
  }
  if ('text' in message && typeof message.text === 'string') {
    return message.text;
  }
  // If message has content array, extract text from it
  if ('content' in message && Array.isArray(message.content)) {
    const textContent = message.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n\n');

    if (textContent.trim()) {
      return textContent;
    }
  }

  // Try to extract from message object if it has a message property
  if ('message' in message && message.message && typeof message.message === 'object') {
    const msg = message.message as any;
    if ('content' in msg && Array.isArray(msg.content)) {
      const textContent = msg.content
        .filter((item: any) => item.type === 'text')
        .map((item: any) => item.text)
        .join('\n\n');

      if (textContent.trim()) {
        return textContent;
      }
    }
  }

  // Last resort: return a generic message instead of JSON
  return JSON.stringify(message);
}
