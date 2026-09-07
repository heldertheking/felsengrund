import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import styles from '../Offers.module.css'
import { Offer } from '../../../types/types'

export function OfferDetailPage() {
    const { guid } = useParams<{ guid: string }>()
    const [offer, setOffer] = useState<Offer | null>(null)
    const [error, setError] = useState(false)

    useEffect(() => {
        setOffer(null)
        setError(false)
        fetch(`/api/offers/${guid}`)
            .then((res) => {
                if (!res.ok) throw new Error('Failed to load offer')
                return res.json() as Promise<Offer>
            })
            .then(setOffer)
            .catch(() => setError(true))
    }, [guid])

    if (error) return <p>Dieses Angebot konnte nicht gefunden werden.</p>
    if (!offer) return <p>Lade Angebot...</p>

    return (
        <article className={styles.detail}>
            {offer.image && <img className={styles.detailImage} src={offer.image} alt={offer.title} />}
            <h1>{offer.title}</h1>
            <p className={styles.cardIntro}>{offer.intro}</p>

            <dl className={styles.detailMeta}>
                {offer.schedule.displayTime && (
                    <>
                        <dt>Wann</dt>
                        <dd>{offer.schedule.displayTime}</dd>
                    </>
                )}
                {offer.location.name && (
                    <>
                        <dt>Wo</dt>
                        <dd>
                            {offer.location.mapsLink ? (
                                <a href={offer.location.mapsLink} target="_blank" rel="noreferrer">
                                    {offer.location.name}
                                </a>
                            ) : (
                                offer.location.name
                            )}
                        </dd>
                    </>
                )}
                {offer.registration.required && (
                    <>
                        <dt>Anmeldung</dt>
                        <dd>Erforderlich</dd>
                    </>
                )}
            </dl>

            <div className={styles.detailBody}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{offer.description}</ReactMarkdown>
            </div>

            {offer.organizers.length > 0 && (
                <section>
                    <h2>Organisation</h2>
                    <ul className={styles.organizerList}>
                        {offer.organizers.map((organizer) => (
                            <li key={organizer.name}>
                                <strong>{organizer.name}</strong>
                                {organizer.role && <span> — {organizer.role}</span>}
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </article>
    )
}
