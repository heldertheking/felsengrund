import { useState } from 'react'
import type { FormEvent } from 'react'
import { apiUrl } from '../../lib/api'

type Status = 'idle' | 'submitting' | 'success' | 'error'

/**
 * "Jetzt für mich beten" prayer request form (feeds the "Gebetswand" on the
 * live site). POSTs to the Worker's /prayer-request endpoint, the same one
 * used by the dedicated /jetzt-fuer-mich-beten page.
 */
export default function PrayerWallForm() {
  const [topic, setTopic] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [email, setEmail] = useState('')
  const [prayUntil, setPrayUntil] = useState('')
  const [publish, setPublish] = useState(false)
  const [status, setStatus] = useState<Status>('idle')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('submitting')

    try {
      const response = await fetch(apiUrl('/prayer-request'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          displayName,
          description,
          email: email || undefined,
          prayUntil: prayUntil || undefined,
          publishOnWall: publish,
        }),
      })
      if (!response.ok) throw new Error(`Unexpected response: ${response.status}`)

      setStatus('success')
      setTopic('')
      setDisplayName('')
      setDescription('')
      setEmail('')
      setPrayUntil('')
      setPublish(false)
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <p className="rounded-lg border border-kf-edge bg-kf-surface p-6 text-kf-ink" role="status">
        Danke für dein Vertrauen. Dein Gebetsanliegen wurde übermittelt.
      </p>
    )
  }

  return (
    <form className="space-y-5 rounded-xl border border-kf-edge bg-kf-surface p-6 shadow-sm sm:p-8" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="pw-topic" className="block text-sm font-medium text-kf-ink">
          Um welches Thema geht es? *
        </label>
        <input
          id="pw-topic"
          type="text"
          required
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-kf-edge px-3 py-2 text-sm text-kf-ink focus:border-kf-accent focus:outline-none focus:ring-1 focus:ring-kf-accent"
        />
      </div>

      <div>
        <label htmlFor="pw-name" className="block text-sm font-medium text-kf-ink">
          Wie möchtest du genannt werden? *
        </label>
        <input
          id="pw-name"
          type="text"
          required
          placeholder="z. B. dein Vorname oder anonym"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-kf-edge px-3 py-2 text-sm text-kf-ink focus:border-kf-accent focus:outline-none focus:ring-1 focus:ring-kf-accent"
        />
      </div>

      <div>
        <label htmlFor="pw-description" className="block text-sm font-medium text-kf-ink">
          Erzähl uns mehr *
        </label>
        <textarea
          id="pw-description"
          required
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-kf-edge px-3 py-2 text-sm text-kf-ink focus:border-kf-accent focus:outline-none focus:ring-1 focus:ring-kf-accent"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="pw-email" className="block text-sm font-medium text-kf-ink">
            E-Mail (optional, für Rückmeldungen)
          </label>
          <input
            id="pw-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-kf-edge px-3 py-2 text-sm text-kf-ink focus:border-kf-accent focus:outline-none focus:ring-1 focus:ring-kf-accent"
          />
        </div>

        <div>
          <label htmlFor="pw-until" className="block text-sm font-medium text-kf-ink">
            Wie lange sollen wir für dich beten?
          </label>
          <input
            id="pw-until"
            type="date"
            value={prayUntil}
            onChange={(e) => setPrayUntil(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-kf-edge px-3 py-2 text-sm text-kf-ink focus:border-kf-accent focus:outline-none focus:ring-1 focus:ring-kf-accent"
          />
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-kf-ink">
          Darf dein Anliegen (anonym) auf der öffentlichen Gebetswand veröffentlicht werden?
        </legend>
        <div className="mt-2 flex flex-wrap gap-6">
          <label className="flex min-h-11 items-center gap-2 py-2 text-sm text-kf-ink-muted">
            <input
              type="radio"
              name="pw-publish"
              checked={publish}
              onChange={() => setPublish(true)}
              className="accent-kf-accent"
            />
            Ja
          </label>
          <label className="flex min-h-11 items-center gap-2 py-2 text-sm text-kf-ink-muted">
            <input
              type="radio"
              name="pw-publish"
              checked={!publish}
              onChange={() => setPublish(false)}
              className="accent-kf-accent"
            />
            Nein, nur vertraulich beten
          </label>
        </div>
      </fieldset>

      <p className="text-xs text-kf-ink-muted">
        Deine Angaben werden vertraulich behandelt und ausschliesslich für dieses Gebetsanliegen verwendet.
      </p>

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
        {status === 'submitting' ? 'Wird gesendet…' : 'Gebetsanliegen senden'}
      </button>
    </form>
  )
}
