import { useState } from 'react'
import type { FormEvent } from 'react'
import { apiUrl } from '../../lib/api'

type Status = 'idle' | 'submitting' | 'success' | 'error'

/**
 * "Parkplatz" sermon feedback form. POSTs to the Worker's /feedback endpoint.
 */
export default function FeedbackForm() {
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('submitting')

    try {
      const response = await fetch(apiUrl('/feedback'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          name: name || undefined,
          email: email || undefined,
        }),
      })
      if (!response.ok) throw new Error(`Unexpected response: ${response.status}`)

      setStatus('success')
      setMessage('')
      setName('')
      setEmail('')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <p className="rounded-lg border border-kf-edge bg-kf-surface p-6 text-kf-ink" role="status">
        Danke für deine Rückmeldung – wir haben sie erhalten.
      </p>
    )
  }

  return (
    <form className="space-y-5 rounded-xl border border-kf-edge bg-kf-surface p-6 shadow-sm sm:p-8" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="pk-message" className="block text-sm font-medium text-kf-ink">
          Deine Frage, dein Anliegen oder Feedback *
        </label>
        <textarea
          id="pk-message"
          required
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-kf-edge px-3 py-2 text-sm text-kf-ink focus:border-kf-accent focus:outline-none focus:ring-1 focus:ring-kf-accent"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="pk-name" className="block text-sm font-medium text-kf-ink">
            Name (optional)
          </label>
          <input
            id="pk-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-kf-edge px-3 py-2 text-sm text-kf-ink focus:border-kf-accent focus:outline-none focus:ring-1 focus:ring-kf-accent"
          />
        </div>

        <div>
          <label htmlFor="pk-email" className="block text-sm font-medium text-kf-ink">
            E-Mail (optional)
          </label>
          <input
            id="pk-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-kf-edge px-3 py-2 text-sm text-kf-ink focus:border-kf-accent focus:outline-none focus:ring-1 focus:ring-kf-accent"
          />
        </div>
      </div>

      {status === 'error' && (
        <p className="text-sm text-red-700" role="alert">
          Das hat leider nicht geklappt. Bitte versuche es später erneut.
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="rounded-lg bg-kf-accent px-5 py-3 font-display text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {status === 'submitting' ? 'Wird gesendet…' : 'Feedback senden'}
      </button>
    </form>
  )
}
