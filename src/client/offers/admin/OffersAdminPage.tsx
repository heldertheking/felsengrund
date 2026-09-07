import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from '../Offers.module.css'
import { OfferSummary } from '../../../types/types'

export function OffersAdminPage() {
    const [offers, setOffers] = useState<OfferSummary[] | null>(null)

    const loadOffers = useCallback(async () => {
        const res = await fetch('/api/admin/offers', { credentials: 'include' })
        setOffers((await res.json()) as OfferSummary[])
    }, [])

    useEffect(() => {
        loadOffers()
    }, [loadOffers])

    async function handleDelete(guid: string, title: string) {
        if (!confirm(`"${title}" wirklich löschen?`)) return
        await fetch(`/api/admin/offers/${guid}`, { method: 'DELETE', credentials: 'include' })
        await loadOffers()
    }

    return (
        <section className={styles.adminPage}>
            <header className={styles.adminHeader}>
                <h1>Angebote verwalten</h1>
                <div className={styles.adminHeaderActions}>
                    <Link to="/admin/offers/new" className={styles.newOfferButton}>+ Neues Angebot</Link>
                </div>
            </header>

            {offers === null && <p>Lade...</p>}
            {offers?.length === 0 && <p>Noch keine Angebote.</p>}

            <ul className={styles.adminList}>
                {offers?.map((offer) => (
                    <li key={offer.guid} className={styles.adminListItem}>
                        <div>
                            <strong>{offer.title}</strong>
                            {offer.displayTime && <span> — {offer.displayTime}</span>}
                        </div>
                        <div className={styles.adminListActions}>
                            <Link to={`/admin/offers/${offer.guid}`}>Bearbeiten</Link>
                            <button onClick={() => handleDelete(offer.guid, offer.title)}>Löschen</button>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    )
}
