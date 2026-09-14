import { useEffect, useState } from 'react';
import { apiClient } from '../lib/api';
import type { EpisodeDetailResponse } from '@felsengrund/types';
import Breadcrumbs from './Breadcrumbs';
import PodcastPlayer from './PodcastPlayer';
import SpeakerPills from './SpeakerPills';

type State =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error' }
  | { status: 'ready'; episode: EpisodeDetailResponse };

function currentSlug(): string {
  // See OfferDetail.tsx's currentSlug for why this guards against a server-render pass.
  if (typeof window === 'undefined') return '';
  const segments = window.location.pathname.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? '';
}

export default function PodcastDetail() {
  const [slug] = useState(currentSlug);
  const [state, setState] = useState<State>(
    slug && slug !== 'podcast' ? { status: 'loading' } : { status: 'not-found' },
  );

  useEffect(() => {
    if (!slug || slug === 'podcast') return;

    let cancelled = false;

    apiClient.podcast
      .get(slug)
      .then((episode) => {
        if (cancelled) return;
        if (!episode) setState({ status: 'not-found' });
        else setState({ status: 'ready', episode });
      })
      .catch((error) => {
        console.error('Failed to load podcast episode', error);
        if (!cancelled) setState({ status: 'error' });
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const baseCrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Podcast', href: '/podcast' },
  ];

  if (state.status === 'loading') {
    return (
      <div>
        <Breadcrumbs items={[...baseCrumbs, { label: '…' }]} />
        <p className="text-sm text-kf-ink-muted">Wird geladen …</p>
      </div>
    );
  }

  if (state.status === 'not-found') {
    return (
      <div>
        <Breadcrumbs items={[...baseCrumbs, { label: 'Nicht gefunden' }]} />
        <h1 className="font-display text-3xl font-bold text-kf-ink">Episode nicht gefunden</h1>
        <p className="mt-4 text-kf-ink-muted">
          Diese Episode existiert nicht (mehr). Schau dir{' '}
          <a href="/podcast" className="text-kf-accent underline underline-offset-2">
            alle Episoden
          </a>{' '}
          an.
        </p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div>
        <Breadcrumbs items={[...baseCrumbs, { label: 'Fehler' }]} />
        <p className="text-sm text-red-700" role="alert">
          Die Episode konnte nicht geladen werden. Bitte lade die Seite neu.
        </p>
      </div>
    );
  }

  const { episode } = state;

  return (
    <article>
      <Breadcrumbs items={[...baseCrumbs, { label: episode.data.title }]} />
      {episode.data.coverImage && (
        <img
          src={episode.data.coverImage}
          alt={episode.data.title}
          className="mb-6 aspect-video w-full rounded-xl object-cover"
        />
      )}
      <p className="font-display text-sm font-semibold uppercase tracking-wide text-kf-accent">
        Podcast
        {episode.data.episodeNumber ? ` · Folge ${episode.data.episodeNumber}` : ''}
      </p>
      <h1 className="mt-2 break-words font-display text-4xl font-bold text-kf-ink">{episode.data.title}</h1>
      <p className="mt-2 text-sm text-kf-ink-muted">
        {new Date(episode.data.publishDate).toLocaleDateString('de-CH')}
        {episode.data.duration && <> · {episode.data.duration}</>}
      </p>

      <div className="mt-6 rounded-2xl border border-kf-edge bg-kf-surface-sunken p-5">
        <PodcastPlayer src={episode.data.audioUrl} title={episode.data.title} />
      </div>

      <SpeakerPills speakers={episode.data.speakers ?? []} />

      <div className="prose prose-neutral mt-10 max-w-none" dangerouslySetInnerHTML={{ __html: episode.bodyHtml }} />

      <p className="mt-10 text-sm text-kf-ink-muted">
        Bei Fragen zu dieser Episode melde dich gerne über das{' '}
        <a
          href={`/kontakt?subject=${encodeURIComponent(`Frage zu Podcast episode ${episode.data.title}`)}`}
          className="text-kf-accent underline underline-offset-2"
        >
          Kontaktformular
        </a>
      </p>
    </article>
  );
}
