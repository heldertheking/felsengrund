/**
 * Relays a form submission to the church's n8n instance, which is responsible for actually
 * notifying someone (email, Slack, whatever they configure) — this codebase never sends email
 * directly. The browser never talks to n8n or sees its URL/secret; only this server-side call does.
 *
 * Authentication: an HMAC-SHA256 signature of the raw JSON body, computed with N8N_WEBHOOK_SECRET,
 * sent as `X-Webhook-Signature`. n8n's workflow must recompute the same HMAC over the raw body and
 * compare (constant-time) before trusting the payload — this proves the request came from this
 * Worker (which holds the secret) without ever exposing that secret to a client.
 */
export interface NotifyEnv {
  N8N_WEBHOOK_URL: string
  N8N_WEBHOOK_SECRET?: string
}

export async function sendNotification(
  env: NotifyEnv,
  formType: string,
  fields: Record<string, string | undefined>,
) {
  if (!env.N8N_WEBHOOK_SECRET) {
    throw new Error('N8N_WEBHOOK_SECRET is not configured.')
  }

  const body = JSON.stringify({ formType, fields })
  const signature = await hmacSha256Hex(env.N8N_WEBHOOK_SECRET, body)

  const response = await fetch(env.N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
    },
    body,
  })

  if (!response.ok) {
    throw new Error(`n8n webhook responded with ${response.status}`)
  }
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
