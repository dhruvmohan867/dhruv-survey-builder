export async function onRequest(context) {
  const url = new URL(context.request.url);
  
  // Construct the target URL on the Cloudflare Worker backend
  const backendUrl = `https://sde-intern-task-api.dhruvms.workers.dev${url.pathname}${url.search}`;
  
  // Clone the request with the new target URL
  const newRequest = new Request(backendUrl, {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.body,
    redirect: context.request.redirect,
  });
  
  // Fetch from the backend worker and return the response
  return fetch(newRequest);
}
