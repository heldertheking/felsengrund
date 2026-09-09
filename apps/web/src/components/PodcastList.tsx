import { useEffect, useState } from 'react'
import { apiUrl } from '../lib/api'
import type { PodcastEpisode } from '../lib/types'

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; episodes: PodcastEpisode[] }

export default function PodcastList() {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    fetch(apiUrl('/podcast'))
      .then((response) => {
        if (!response.ok) throw new Error(`/podcast responded with ${response.status}`)
        return response.json() as Promise<PodcastEpisode[]>
      })
      .then((episodes) => {
        if (!cancelled) setState({ status: 'ready', episodes })
      })
      .catch((error) => {
        console.error('Failed to load podcast episodes', error)
        if (!cancelled) setState({ status: 'error' })
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'loading') {
    return <p className="mt-10 text-sm text-kf-ink-muted">Episoden werden geladen …</p>
  }

  if (state.status === 'error') {
    return (
      <p className="mt-10 text-sm text-red-700" role="alert">
        Die Episoden konnten nicht geladen werden. Bitte lade die Seite neu.
      </p>
    )
  }

  if (state.episodes.length === 0) {
    return <p className="mt-10 text-sm text-kf-ink-muted">Noch keine Episoden veröffentlicht.</p>
  }

  return (
    <ol className="mt-10 divide-y divide-kf-edge border-y border-kf-edge">
      {state.episodes.map((episode) => (
        <li key={episode.slug} className="py-5">
          <a href={`/podcast/${episode.slug}`} className="group flex items-center gap-4">
            {episode.data.coverImage && (
              <img
                src={episode.data.coverImage}
                alt={episode.data.title}
                className="h-14 w-14 shrink-0 rounded-lg object-cover"
              />
            )}
            <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="break-words font-display font-semibold text-kf-ink group-hover:text-kf-accent">
                  {episode.data.title}
                </p>
                <p className="mt-1 text-sm text-kf-ink-muted">
                  {new Date(episode.data.publishDate).toLocaleDateString('de-CH')}
                  {episode.data.duration && <> · {episode.data.duration}</>}
                </p>
              </div>
            </div>
          </a>
        </li>
      ))}
    </ol>
  )
}
