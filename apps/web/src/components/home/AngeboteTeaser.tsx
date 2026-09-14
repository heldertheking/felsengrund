import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/api';
import { CATEGORY_DETAILS, type Offer } from '@felsengrund/types';

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; offers: Offer[] };

export default function AngeboteTeaser() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    apiClient.offers
      .list()
      .then((offers) => {
        if (!cancelled) setState({ status: 'ready', offers });
      })
      .catch((error) => {
        console.error('Failed to load offers teaser', error);
        if (!cancelled) setState({ status: 'error' });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const featured =
    state.status === 'ready'
      ? state.offers
          .slice()
          .sort((a, b) => CATEGORY_DETAILS[a.data.category].index - CATEGORY_DETAILS[b.data.category].index)
          .slice(0, 4)
      : [];

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold text-kf-ink">Aktuelle Angebote</h2>
          <p className="mt-2 text-lg text-kf-ink-muted">
            Für jede Generation etwas – vom Kids-Treff bis zur Seniorenrunde.
          </p>
        </div>
        <a
          href="/angebote"
          className="whitespace-nowrap font-display text-sm font-semibold text-kf-accent hover:underline"
        >
          Alle Angebote ansehen →
        </a>
      </div>

      {state.status === 'loading' && <p className="mt-8 text-sm text-kf-ink-muted">Angebote werden geladen …</p>}
      {state.status === 'error' && (
        <p className="mt-8 text-sm text-kf-ink-muted">
          Unsere Angebote werden gerade zusammengestellt – schau bald wieder vorbei.
        </p>
      )}
      {state.status === 'ready' && featured.length === 0 && (
        <p className="mt-8 text-sm text-kf-ink-muted">
          Unsere Angebote werden gerade zusammengestellt – schau bald wieder vorbei.
        </p>
      )}
      {featured.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((offer) => (
            <a
              key={offer.slug}
              href={`/angebote/${offer.slug}`}
              className="rounded-xl border border-kf-edge bg-kf-surface p-5 transition hover:border-kf-accent hover:shadow-md"
            >
              {offer.data.cardImage && (
                <img
                  src={offer.data.cardImage}
                  alt={offer.data.title}
                  className="mb-3 aspect-video w-full rounded-lg object-cover"
                />
              )}
              <p className="font-display font-semibold text-kf-ink">{offer.data.title}</p>
              {offer.data.intro && <p className="mt-1.5 text-sm text-kf-ink-muted">{offer.data.intro}</p>}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
