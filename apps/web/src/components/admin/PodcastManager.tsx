import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { apiClient } from '../../lib/api'
import { UnauthorizedError, type Episode, type PodcastSpeaker } from '@felsengrund/types'
import { downloadMdocExport } from '../../lib/export'

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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  function reload() {
    apiClient.podcast
      .list()
      .then((data) => {
        setEpisodes(data)
        setSelected((prev) => new Set([...prev].filter((slug) => data.some((e) => e.slug === slug))))
      })
      .catch(() => setListError('Episoden konnten nicht geladen werden.'))
  }

  useEffect(() => {
    reload()
  }, [])

  function toggleSelected(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  function toggleSelectAll() {
    if (!episodes) return
    setSelected((prev) => (prev.size === episodes.length ? new Set() : new Set(episodes.map((e) => e.slug))))
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return
    if (!confirm(`${selected.size} Episode(n) wirklich löschen?`)) return
    setBulkBusy(true)
    try {
      for (const slug of selected) {
        await apiClient.podcast.delete(slug)
      }
      setSelected(new Set())
      reload()
    } catch (err) {
      if (err instanceof UnauthorizedError) return onUnauthorized()
      alert(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.')
    } finally {
      setBulkBusy(false)
    }
  }

  function handleBulkExport() {
    if (!episodes) return
    const rows = episodes
      .filter((e) => selected.has(e.slug))
      .map((e) => ({ slug: e.slug, data: e.data as unknown as Record<string, unknown>, body: e.body }))
    downloadMdocExport('podcast-export', rows)
  }

  if (mode.view === 'form') {
    return (
      <PodcastForm
        episode={mode.episode}
        episodes={episodes}
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

      {episodes && episodes.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2 text-kf-ink-muted">
            <input
              type="checkbox"
              checked={selected.size === episodes.length}
              onChange={toggleSelectAll}
              className="rounded border-kf-edge"
            />
            Alle auswählen
          </label>
          {selected.size > 0 && (
            <>
              <span className="text-kf-ink-muted">{selected.size} ausgewählt</span>
              <button
                type="button"
                onClick={handleBulkExport}
                className="rounded-lg border border-kf-edge px-3 py-1.5 text-xs font-semibold text-kf-ink transition hover:border-kf-accent hover:text-kf-accent"
              >
                Exportieren
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={handleBulkDelete}
                className="rounded-lg border border-red-600 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                Löschen
              </button>
            </>
          )}
        </div>
      )}

      {episodes && (
        <ul className="mt-4 divide-y divide-kf-edge border-y border-kf-edge">
          {episodes.map((episode) => (
            <li key={episode.slug} className="flex items-center justify-between gap-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(episode.slug)}
                  onChange={() => toggleSelected(episode.slug)}
                  className="shrink-0 rounded border-kf-edge"
                />
                <div className="min-w-0">
                  <p className="truncate font-medium text-kf-ink">{episode.data.title}</p>
                  <p className="text-xs text-kf-ink-muted">{episode.slug}</p>
                </div>
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

function nextEpisodeNumber(episodes: Episode[] | null): string {
  if (!episodes || episodes.length === 0) return '1'
  const max = Math.max(0, ...episodes.map((e) => e.data.episodeNumber ?? 0))
  return String(max + 1)
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.round(totalSeconds)
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

function PodcastForm({
  episode,
  episodes,
  onDone,
  onUnauthorized,
}: {
  episode: Episode | null
  episodes: Episode[] | null
  onDone: () => void
  onUnauthorized: () => void
}) {
  const isEdit = episode !== null
  const [title, setTitle] = useState(episode?.data.title ?? '')
  const [episodeNumber, setEpisodeNumber] = useState(
    episode?.data.episodeNumber?.toString() ?? nextEpisodeNumber(episodes),
  )
  const [publishDate, setPublishDate] = useState(episode?.data.publishDate ?? '')
  const [duration, setDuration] = useState(episode?.data.duration ?? '')
  const [audio, setAudio] = useState<File | null>(null)
  const [coverImage, setCoverImage] = useState<File | null>(null)
  const [speakers, setSpeakers] = useState<PodcastSpeaker[]>(episode?.data.speakers ?? [])
  const [body, setBody] = useState(episode?.body ?? '')
  const [status, setStatus] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function updateSpeaker(index: number, field: keyof PodcastSpeaker, value: string | boolean) {
    setSpeakers((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  function handleAudioChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setAudio(file)
    if (!file) return

    const objectUrl = URL.createObjectURL(file)
    const probe = new Audio()
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => {
      if (Number.isFinite(probe.duration)) setDuration(formatDuration(probe.duration))
      URL.revokeObjectURL(objectUrl)
    }
    probe.onerror = () => URL.revokeObjectURL(objectUrl)
    probe.src = objectUrl
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('Wird gespeichert …')
    setSubmitting(true)

    try {
      const speakersInput = speakers.filter((s) => s.name.trim())

      if (isEdit) {
        await apiClient.podcast.update(episode.slug, {
          title,
          publishDate,
          episodeNumber: episodeNumber ? Number(episodeNumber) : undefined,
          duration,
          speakers: speakersInput,
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
          speakers: speakersInput,
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
          onChange={handleAudioChange}
          className={fileInputClass}
        />
        {isEdit && <p className="mt-1 text-xs text-kf-ink-muted">Leer lassen, um die bestehende Datei zu behalten.</p>}
      </div>

      <div>
        <span className={labelClass}>Sprecher</span>
        <div className="mt-2 flex flex-col gap-2">
          {speakers.map((speaker, index) => (
            <div key={index} className="grid grid-cols-1 gap-2 rounded-lg border border-kf-edge p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <input
                type="text"
                placeholder="Name"
                value={speaker.name}
                onChange={(e) => updateSpeaker(index, 'name', e.target.value)}
                className={inputClass}
              />
              <label className="flex items-center gap-2 text-xs font-medium text-kf-ink-muted">
                <input
                  type="checkbox"
                  checked={speaker.main ?? false}
                  onChange={(e) => updateSpeaker(index, 'main', e.target.checked)}
                  className="rounded border-kf-edge"
                />
                Hauptsprecher
              </label>
              <button
                type="button"
                onClick={() => setSpeakers((rows) => rows.filter((_, i) => i !== index))}
                className="justify-self-start rounded-lg border border-kf-edge px-3 py-2 text-xs font-semibold text-kf-ink-muted transition hover:border-red-600 hover:text-red-600 sm:justify-self-center"
              >
                Entfernen
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSpeakers((rows) => [...rows, { name: '' }])}
          className="mt-2 rounded-lg border border-kf-edge px-3 py-1.5 text-xs font-semibold text-kf-ink transition hover:border-kf-accent hover:text-kf-accent"
        >
          Sprecher hinzufügen
        </button>
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
