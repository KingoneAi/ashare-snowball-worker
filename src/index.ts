export interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  APP_PREFIX?: string
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

/**
 * Supabase shared DB table naming helper.
 * Convention: <appName>__<table>
 */
export function table(appPrefix: string, tableName: string) {
  return appPrefix + '__' + tableName
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true })
    }

    if (request.method === 'GET' && url.pathname === '/api/ping') {
      const prefix = env.APP_PREFIX || 'ashare-snowball'
      // Example: table(prefix, 'profiles') => "ashare-snowball__profiles"
      return json({ pong: true, time: new Date().toISOString(), exampleTable: table(prefix, 'profiles') })
    }

    return json({ error: 'Not found' }, 404)
  },
}
