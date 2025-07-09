import { logWithContext } from "../log";
import { handleGitLabIssuesEvent } from "./gitlab_webhooks/issue";
import { handleGitLabNoteEvent } from "./gitlab_webhooks/note";
import { handleGitLabMergeRequestEvent } from "./gitlab_webhooks/merge_request";

// Route GitLab webhook events to specific handlers
async function routeGitLabEvent(data: any, configDO: any, env: any, ctx: ExecutionContext): Promise<Response> {
  logWithContext('GITLAB_EVENT_ROUTER', 'Routing GitLab event', {
    objectKind: data.object_kind,
    action: data.object_attributes?.action,
    project: data.project?.path_with_namespace
  });

  switch (data.object_kind) {
    case 'issue':
      logWithContext('GITLAB_EVENT_ROUTER', 'Routing to issue handler');
      return await handleGitLabIssuesEvent(data, env, configDO, ctx);

    case 'note':
      logWithContext('GITLAB_EVENT_ROUTER', 'Routing to note handler');
      return await handleGitLabNoteEvent(data, env, configDO);

    case 'merge_request':
      logWithContext('GITLAB_EVENT_ROUTER', 'Routing to merge request handler');
      return await handleGitLabMergeRequestEvent(data, env, configDO);

    default:
      logWithContext('GITLAB_EVENT_ROUTER', 'Unhandled GitLab event', {
        objectKind: data.object_kind,
        availableEvents: ['issue', 'note', 'merge_request']
      });
      return new Response('Event type not supported', { status: 200 });
  }
}

// Direct token comparison for GitLab webhooks (simpler than GitHub HMAC)
function verifyGitLabToken(providedToken: string, expectedSecret: string): boolean {
  if (!expectedSecret) {
    return false;
  }
  
  // Direct string comparison (GitLab uses simple token, not HMAC)
  return providedToken === expectedSecret;
}

export async function handleGitLabWebhook(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
  const startTime = Date.now();
  
  try {
    // Check for required headers
    const token = request.headers.get('X-Gitlab-Token');
    const event = request.headers.get('X-Gitlab-Event');
    
    logWithContext('GITLAB_WEBHOOK', 'Received GitLab webhook', {
      event,
      hasToken: !!token,
      headers: {
        userAgent: request.headers.get('user-agent'),
        contentType: request.headers.get('content-type')
      }
    });
    
    if (!token || !event) {
      logWithContext('GITLAB_WEBHOOK', 'Missing required webhook headers', {
        hasToken: !!token,
        hasEvent: !!event
      });
      return new Response('Missing required headers', { status: 400 });
    }

    // Parse the payload to get project info
    let webhookData;
    try {
      const payload = await request.text();
      webhookData = JSON.parse(payload);
      
      logWithContext('GITLAB_WEBHOOK', 'Webhook payload parsed successfully', {
        objectKind: webhookData.object_kind,
        hasProject: !!webhookData.project,
        action: webhookData.action
      });
    } catch (error) {
      logWithContext('GITLAB_WEBHOOK', 'Invalid JSON payload', {
        error: error instanceof Error ? error.message : String(error)
      });
      return new Response('Invalid JSON payload', { status: 400 });
    }

    // Get project ID for config lookup
    const projectId = webhookData.project?.id?.toString();
    if (!projectId) {
      logWithContext('GITLAB_WEBHOOK', 'No project ID in webhook payload');
      return new Response('No project information', { status: 400 });
    }

    // Get GitLab configuration for this specific project
    logWithContext('GITLAB_WEBHOOK', 'Retrieving GitLab configuration', { projectId });
    
    const configDO = env.GITLAB_APP_CONFIG.get(env.GITLAB_APP_CONFIG.idFromName('gitlab-config'));
    
    // First try to get project-specific configuration
    let configResponse = await configDO.fetch(`http://config/get-credentials?project_id=${projectId}`);
    let credentials = null;
    
    if (configResponse.ok) {
      credentials = await configResponse.json();
    }
    
    // If no project-specific config found, check if project belongs to a configured group
    if (!credentials && webhookData.project?.path_with_namespace) {
      logWithContext('GITLAB_WEBHOOK', 'Checking group-level configuration', { 
        projectNamespace: webhookData.project.path_with_namespace 
      });
      
      const groupResponse = await configDO.fetch('http://config/is-project-in-group', {
        method: 'POST',
        body: JSON.stringify({ projectNamespace: webhookData.project.path_with_namespace })
      });
      
      if (groupResponse.ok) {
        credentials = await groupResponse.json();
        logWithContext('GITLAB_WEBHOOK', 'Found group-level configuration', { 
          groupId: credentials?.groupId,
          groupPath: credentials?.groupPath
        });
      }
    }
    
    if (!credentials) {
      logWithContext('GITLAB_WEBHOOK', 'No GitLab configuration found', { 
        projectId,
        projectNamespace: webhookData.project?.path_with_namespace
      });
      return new Response('GitLab app not configured', { status: 404 });
    }
    if (!credentials || !credentials.webhookSecret) {
      logWithContext('GITLAB_WEBHOOK', 'No webhook secret found', {
        projectId,
        hasCredentials: !!credentials
      });
      return new Response('Webhook secret not found', { status: 500 });
    }

    // Verify the webhook token
    logWithContext('GITLAB_WEBHOOK', 'Verifying webhook token');
    
    const isValid = verifyGitLabToken(token, credentials.webhookSecret);
    
    logWithContext('GITLAB_WEBHOOK', 'Token verification result', { isValid });
    
    if (!isValid) {
      logWithContext('GITLAB_WEBHOOK', 'Invalid webhook token');
      return new Response('Invalid token', { status: 401 });
    }

    // Route to appropriate event handler based on object_kind
    logWithContext('GITLAB_WEBHOOK', 'Routing to event handler', {
      objectKind: webhookData.object_kind,
      event
    });

    const eventResponse = await routeGitLabEvent(webhookData, configDO, env, ctx);

    const processingTime = Date.now() - startTime;
    logWithContext('GITLAB_WEBHOOK', 'Webhook processing completed', {
      event,
      projectId,
      processingTimeMs: processingTime,
      responseStatus: eventResponse.status
    });

    return eventResponse;

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logWithContext('GITLAB_WEBHOOK', 'Webhook processing error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      processingTimeMs: processingTime
    });
    return new Response('Internal server error', { status: 500 });
  }
}