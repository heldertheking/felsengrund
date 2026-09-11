import { useEffect, useState } from 'react'
import { apiClient } from '../lib/api'
import { CATEGORY_DETAILS, type Offer } from '@felsengrund/types'

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; offers: Offer[] }

export default function OffersGrid() {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    apiClient.offers
      .list()
      .then((offers) => {
        if (!cancelled) setState({ status: 'ready', offers })
      })
      .catch((error) => {
        console.error('Failed to load offers', error)
        if (!cancelled) setState({ status: 'error' })
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'loading') {
    return <p className="mt-8 text-sm text-kf-ink-muted">Angebote werden geladen …</p>
  }

  if (state.status === 'error') {
    return (
      <p className="mt-8 text-sm text-red-700" role="alert">
        Die Angebote konnten nicht geladen werden. Bitte lade die Seite neu.
      </p>
    )
  }

  const { offers } = state

  return (
    <>
      {Object.entries(CATEGORY_DETAILS)
        .sort((a, b) => a[1].index - b[1].index)
        .map(([category, details]) => {
        const items = offers.filter((offer) => offer.data.category === category)
        const isHilfeService = category === 'hilfe-service'
        if (items.length === 0 && !isHilfeService) return null

        return (
          <div key={category} className="mt-12 first:mt-0">
            <h2 className="font-display text-xl font-semibold text-kf-accent">{details.label}</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((offer) => (
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
              {isHilfeService && (
                <a
                  href="/ich-brauche-hilfe"
                  className="rounded-xl border border-kf-edge bg-kf-surface p-5 transition hover:border-kf-accent hover:shadow-md"
                >
                  <p className="font-display font-semibold text-kf-ink">Ich brauche Hilfe</p>
                  <p className="mt-1.5 text-sm text-kf-ink-muted">
                    Gebet und vertrauliche Lebensberatung – wir sind für dich da, wenn du Unterstützung brauchst.
                  </p>
                </a>
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}
