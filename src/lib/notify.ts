import { env } from 'cloudflare:workers'

/**
 * Emails a form submission to the church's admin address via Cloudflare Email Service.
 * Requires the sending domain (EMAIL_FROM_ADDRESS) to be onboarded first:
 *   npx wrangler email sending enable <domain>
 * Until that's done, this throws E_SENDER_NOT_VERIFIED.
 */
export async function sendNotification(subject: string, fields: Record<string, string | undefined>) {
  const lines = Object.entries(fields)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')

  await env.EMAIL.send({
    to: env.EMAIL_TO_ADDRESS,
    from: { email: env.EMAIL_FROM_ADDRESS, name: 'Kirche Felsengrund Website' },
    subject,
    text: lines,
    html: `<pre style="font-family: monospace; white-space: pre-wrap;">${escapeHtml(lines)}</pre>`,
  })
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
