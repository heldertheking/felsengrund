import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from '../Offers.module.css'
import { OfferSummary } from '../../../types/types'

export function OffersPage() {
    const [offers, setOffers] = useState<OfferSummary[] | null>(null)
    const [error, setError] = useState(false)

    useEffect(() => {
        fetch('/api/offers')
            .then((res) => {
                if (!res.ok) throw new Error('Failed to load offers')
                return res.json() as Promise<OfferSummary[]>
            })
            .then(setOffers)
            .catch(() => setError(true))
    }, [])

    return (
        <section>
            <h1>Angebote</h1>

            {error && <p>Angebote konnten nicht geladen werden.</p>}
            {offers === null && !error && <p>Lade Angebote...</p>}
            {offers?.length === 0 && <p>Aktuell sind keine Angebote verfügbar.</p>}

            <div className={styles.grid}>
                {offers?.map((offer) => (
                    <Link key={offer.guid} to={`/angebote/${offer.guid}`} className={styles.card}>
                        {offer.cardImage && <img className={styles.cardImage} src={offer.cardImage} alt={offer.title} />}
                        <div className={styles.cardBody}>
                            <h2 className={styles.cardTitle}>{offer.title}</h2>
                            <p className={styles.cardIntro}>{offer.intro}</p>
                            {offer.displayTime && <p className={styles.cardTime}>{offer.displayTime}</p>}
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    )
}
