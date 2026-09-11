import { useEffect, useState, type FormEvent } from 'react'
import { apiClient } from '../../lib/api'
import { UnauthorizedError, type Episode } from '@felsengrund/types'

const inputClass =
  'mt-1 w-full rounded-lg border border-kf-edge bg-kf-surface px-3 py-2 text-sm text-kf-ink focus:border-kf-accent focus:outline-none focus:ring-1 focus:ring-kf-accent'
const fileInputClass =
  'mt-1 w-full rounded-lg border border-kf-edge bg-kf-surface px-3 py-2 text-sm text-kf-ink file:mr-3 file:rounded-md file:border-0 file:bg-kf-accent file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white'
const labelClass = 'text-xs font-semibold uppercase tracking-wide text-kf-ink-muted'

interface Props {
  onUnauthorized: () => void
}

type Mode = { view: 'list' } | { view: 'form'; episode: Episode | null }

export default function PodcastManager({ onUnauthorized }: Props) {
  const [episodes, setEpisodes] = useState<Episode[] | null>(null)
  const [mode, setMode] = useState<Mode>({ view: 'list' })
  const [listError, setListError] = useState<string | null>(null)

  function reload() {
    apiClient.podcast
      .list()
      .then(setEpisodes)
      .catch(() => setListError('Episoden konnten nicht geladen werden.'))
  }

  useEffect(() => {
    reload()
  }, [])

  if (mode.view === 'form') {
    return (
      <PodcastForm
        episode={mode.episode}
        onDone={() => {
          setMode({ view: 'list' })
          reload()
        }}
        onUnauthorized={onUnauthorized}
      />
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-kf-ink">Podcast</h2>
        <button
          type="button"
          onClick={() => setMode({ view: 'form', episode: null })}
          className="rounded-lg bg-kf-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Neue Episode
        </button>
      </div>

      {listError && <p className="mt-4 text-sm text-red-700">{listError}</p>}
      {!episodes && !listError && <p className="mt-4 text-sm text-kf-ink-muted">Wird geladen …</p>}

      {episodes && (
        <ul className="mt-6 divide-y divide-kf-edge border-y border-kf-edge">
          {episodes.map((episode) => (
            <li key={episode.slug} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-kf-ink">{episode.data.title}</p>
                <p className="text-xs text-kf-ink-muted">{episode.slug}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setMode({ view: 'form', episode })}
                  className="rounded-lg border border-kf-edge px-3 py-1.5 text-xs font-semibold text-kf-ink transition hover:border-kf-accent hover:text-kf-accent"
                >
                  Bearbeiten
                </button>
                <DeleteButton slug={episode.slug} onDeleted={reload} onUnauthorized={onUnauthorized} />
              </div>
            </li>
          ))}
          {episodes.length === 0 && <li className="py-3 text-sm text-kf-ink-muted">Noch keine Episoden.</li>}
        </ul>
      )}
    </div>
  )
}

function DeleteButton({
  slug,
  onDeleted,
  onUnauthorized,
}: {
  slug: string
  onDeleted: () => void
  onUnauthorized: () => void
}) {
  const [busy, setBusy] = useState(false)

  async function handleClick() {
    if (!confirm('Diese Episode wirklich löschen?')) return
    setBusy(true)
    try {
      await apiClient.podcast.delete(slug)
      onDeleted()
    } catch (err) {
      if (err instanceof UnauthorizedError) return onUnauthorized()
      alert(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={handleClick}
      className="rounded-lg border border-red-600 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
    >
      Löschen
    </button>
  )
}

function PodcastForm({
  episode,
  onDone,
  onUnauthorized,
}: {
  episode: Episode | null
  onDone: () => void
  onUnauthorized: () => void
}) {
  const isEdit = episode !== null
  const [title, setTitle] = useState(episode?.data.title ?? '')
  const [episodeNumber, setEpisodeNumber] = useState(episode?.data.episodeNumber?.toString() ?? '')
  const [publishDate, setPublishDate] = useState(episode?.data.publishDate ?? '')
  const [duration, setDuration] = useState(episode?.data.duration ?? '')
  const [audio, setAudio] = useState<File | null>(null)
  const [coverImage, setCoverImage] = useState<File | null>(null)
  const [body, setBody] = useState(episode?.body ?? '')
  const [status, setStatus] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('Wird gespeichert …')
    setSubmitting(true)

    try {
      if (isEdit) {
        await apiClient.podcast.update(episode.slug, {
          title,
          publishDate,
          episodeNumber: episodeNumber ? Number(episodeNumber) : undefined,
          duration,
          body,
          audio: audio ?? undefined,
          coverImage: coverImage ?? undefined,
        })
      } else {
        if (!audio) throw new Error('Bitte eine Audiodatei auswählen.')
        await apiClient.podcast.create({
          title,
          publishDate,
          episodeNumber: episodeNumber ? Number(episodeNumber) : undefined,
          duration,
          body,
          audio,
          coverImage: coverImage ?? undefined,
        })
      }
      onDone()
    } catch (err) {
      if (err instanceof UnauthorizedError) return onUnauthorized()
      setStatus(err instanceof Error ? err.message : 'Da ist etwas schiefgelaufen.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-kf-ink">{isEdit ? 'Episode bearbeiten' : 'Neue Episode'}</h2>
        <button type="button" onClick={onDone} className="text-sm text-kf-ink-muted hover:text-kf-accent">
          Zurück zur Liste
        </button>
      </div>

      <div>
        <label className={labelClass}>Titel</label>
        <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        {isEdit && (
          <p className="mt-1 text-xs text-kf-ink-muted">
            Slug: <code>{episode.slug}</code>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Episodennummer</label>
          <input
            type="number"
            min={1}
            step={1}
            value={episodeNumber}
            onChange={(e) => setEpisodeNumber(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Veröffentlichungsdatum</label>
          <input
            type="date"
            required
            value={publishDate}
            onChange={(e) => setPublishDate(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Dauer (z. B. 32:10)</label>
        <input type="text" value={duration} onChange={(e) => setDuration(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>Audiodatei{!isEdit && ' (erforderlich)'}</label>
        {episode?.data.audioUrl && (
          <p className="mt-1 text-xs text-kf-ink-muted">
            Aktuelle Datei:{' '}
            <a href={episode.data.audioUrl} className="text-kf-accent underline underline-offset-2" target="_blank" rel="noreferrer">
              anhören
            </a>
          </p>
        )}
        <input
          type="file"
          accept="audio/*"
          required={!isEdit}
          onChange={(e) => setAudio(e.target.files?.[0] ?? null)}
          className={fileInputClass}
        />
        {isEdit && <p className="mt-1 text-xs text-kf-ink-muted">Leer lassen, um die bestehende Datei zu behalten.</p>}
      </div>

      <div>
        <label className={labelClass}>Cover-Bild</label>
        {episode?.data.coverImage && (
          <img src={episode.data.coverImage} alt="" className="mt-2 h-24 w-24 rounded-lg border border-kf-edge object-cover" />
        )}
        <input type="file" accept="image/*" onChange={(e) => setCoverImage(e.target.files?.[0] ?? null)} className={fileInputClass} />
      </div>

      <div>
        <label className={labelClass}>Shownotes (Markdoc)</label>
        <textarea rows={14} value={body} onChange={(e) => setBody(e.target.value)} className={`${inputClass} font-mono`} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-kf-accent px-5 py-2.5 font-display text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          Speichern
        </button>
        {status && <p className="text-sm text-kf-ink-muted">{status}</p>}
      </div>
    </form>
  )
}
