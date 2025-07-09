// Minimal implementation to make tests pass
export async function handleGitLabWebhook(request: Request, env: any): Promise<Response> {
  // Check for required headers
  const token = request.headers.get('X-Gitlab-Token');
  const event = request.headers.get('X-Gitlab-Event');
  
  if (!token || !event) {
    return new Response('Missing required headers', { status: 400 });
  }

  // Return basic success response for now
  return new Response('OK', { status: 200 });
}