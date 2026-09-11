import {useEffect, useState} from 'react'
import {apiClient} from '../lib/api'
import {CATEGORY_DETAILS, type OfferDetailResponse} from '@felsengrund/types'
import Breadcrumbs from './Breadcrumbs'

type State =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error' }
  | { status: 'ready'; offer: OfferDetailResponse }

function currentSlug(): string {
  // This component always renders via a client:load island, but Astro still server-renders an
  // initial HTML snapshot at build time — window isn't available there. That snapshot briefly
  // shows the "not found" state (slug === ''); hydration on the client re-runs this with the
  // real URL and replaces it immediately.
  if (typeof window === 'undefined') return ''
  const segments = window.location.pathname.split('/').filter(Boolean)
  return segments[segments.length - 1] ?? ''
}

export default function OfferDetail() {
  const [slug] = useState(currentSlug)
  const [state, setState] = useState<State>(slug ? { status: 'loading' } : { status: 'not-found' })

  useEffect(() => {
    if (!slug) return

    let cancelled = false

    apiClient.offers
      .get(slug)
      .then((offer) => {
        if (cancelled) return
        if (!offer) setState({ status: 'not-found' })
        else setState({ status: 'ready', offer })
      })
      .catch((error) => {
        console.error('Failed to load offer', error)
        if (!cancelled) setState({ status: 'error' })
      })

    return () => {
      cancelled = true
    }
  }, [slug])

  const baseCrumbs = [{ label: 'Home', href: '/' }, { label: 'Angebote', href: '/angebote' }]

  if (state.status === 'loading') {
    return (
      <div>
        <Breadcrumbs items={[...baseCrumbs, { label: '…' }]} />
        <p className="text-sm text-kf-ink-muted">Wird geladen …</p>
      </div>
    )
  }

  if (state.status === 'not-found') {
    return (
      <div>
        <Breadcrumbs items={[...baseCrumbs, { label: 'Nicht gefunden' }]} />
        <h1 className="font-display text-3xl font-bold text-kf-ink">Angebot nicht gefunden</h1>
        <p className="mt-4 text-kf-ink-muted">
          Dieses Angebot existiert nicht (mehr). Schau dir{' '}
            <a href="/angebote" className="text-kf-accent underline underline-offset-2">
            alle Angebote
          </a>{' '}
          an.
        </p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div>
        <Breadcrumbs items={[...baseCrumbs, { label: 'Fehler' }]} />
        <p className="text-sm text-red-700" role="alert">
          Das Angebot konnte nicht geladen werden. Bitte lade die Seite neu.
        </p>
      </div>
    )
  }

  const { offer } = state

  return (
    <div>
      <Breadcrumbs items={[...baseCrumbs, { label: offer.data.title }]} />
      {offer.data.cardImage && (
        <img
          src={offer.data.cardImage}
          alt={offer.data.title}
          className="mb-6 aspect-video w-full rounded-xl object-cover"
        />
      )}
      <p className="font-display text-sm font-semibold uppercase tracking-wide text-kf-accent">
        {CATEGORY_DETAILS[offer.data.category].label}
      </p>
        <h1 className="mt-2 wrap-break-word font-display text-4xl font-bold text-kf-ink">{offer.data.title}</h1>
      {offer.data.intro && <p className="mt-4 text-lg text-kf-ink-muted">{offer.data.intro}</p>}

      <dl className="mt-8 grid grid-cols-1 gap-4 rounded-xl border border-kf-edge bg-kf-surface-sunken p-6 sm:grid-cols-2">
        {offer.data.schedule && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-kf-ink-muted">Zeitplan</dt>
            <dd className="mt-1 text-sm text-kf-ink">{offer.data.schedule}</dd>
          </div>
        )}
        {offer.data.location && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-kf-ink-muted">Ort</dt>
            <dd className="mt-1 text-sm text-kf-ink">
              {offer.data.mapsLink ? (
                  <a href={offer.data.mapsLink} className="text-kf-accent underline underline-offset-2">
                  {offer.data.location}
                </a>
              ) : (
                offer.data.location
              )}
            </dd>
          </div>
        )}
        {offer.data.targetAudience && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-kf-ink-muted">Zielgruppe</dt>
            <dd className="mt-1 text-sm text-kf-ink">{offer.data.targetAudience}</dd>
          </div>
        )}
        {offer.data.registration && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-kf-ink-muted">Anmeldung</dt>
            <dd className="mt-1 text-sm text-kf-ink">{offer.data.registration}</dd>
          </div>
        )}
      </dl>

      <div className="prose prose-neutral mt-10 max-w-none" dangerouslySetInnerHTML={{ __html: offer.bodyHtml }} />

      {offer.data.organizers && offer.data.organizers.length > 0 && (
        <div className="mt-10 border-t border-kf-edge pt-6">
          <p className="font-display text-sm font-semibold text-kf-ink">Ansprechpersonen</p>
          <ul className="mt-3 space-y-2">
            {offer.data.organizers.map((person, index) => (
                <li key={index} className="wrap-break-word text-sm text-kf-ink-muted">
                <span className="font-medium text-kf-ink">{person.name}</span>
                    {person.role && <> - {person.role}</>}
                {person.contact && <> · {person.contact}</>}
              </li>
            ))}
          </ul>
        </div>
      )}
        {offer.data.googleMapsIframeLink && (
            <iframe
                src={offer.data.googleMapsIframeLink}
                className="border-0 w-full aspect-5/2" allowFullScreen={false} loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
            />
        )}
        <p className="mt-10 text-sm text-kf-ink-muted">
            Bei Fragen melde dich gerne über das{' '}
            <a
                href={`/kontakt?subject=${encodeURIComponent(`Frage(n) bezüglich ${offer.data.title}`)}`}
                className="text-kf-accent underline underline-offset-2"
            >
                Kontaktformular
            </a>
        </p>
    </div>
  )
}
