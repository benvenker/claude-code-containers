import { logWithContext } from "../log";

// Direct token comparison for GitLab webhooks (simpler than GitHub HMAC)
function verifyGitLabToken(providedToken: string, expectedSecret: string): boolean {
  if (!expectedSecret) {
    return false;
  }
  
  // Direct string comparison (GitLab uses simple token, not HMAC)
  return providedToken === expectedSecret;
}

export async function handleGitLabWebhook(request: Request, env: any): Promise<Response> {
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

    // Get GitLab configuration
    logWithContext('GITLAB_WEBHOOK', 'Retrieving GitLab configuration', { projectId });
    
    const id = env.GITLAB_APP_CONFIG.idFromName(projectId);
    const configDO = env.GITLAB_APP_CONFIG.get(id);
    
    const configResponse = await configDO.fetch(new Request('http://internal/get-credentials'));
    
    if (!configResponse.ok) {
      logWithContext('GITLAB_WEBHOOK', 'No GitLab configuration found', { projectId });
      return new Response('GitLab app not configured', { status: 404 });
    }

    const credentials = await configResponse.json();
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

    const processingTime = Date.now() - startTime;
    logWithContext('GITLAB_WEBHOOK', 'Webhook processing completed', {
      event,
      projectId,
      processingTimeMs: processingTime
    });

    // Return success response for now
    return new Response('OK', { status: 200 });

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