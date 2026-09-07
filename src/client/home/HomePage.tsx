import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './Home.module.css'
import offersStyles from '../offers/Offers.module.css'
import { PrayerWallForm } from './PrayerWallForm.tsx'
import { FeedbackForm } from './FeedbackForm.tsx'
import { OfferSummary } from '../../types/types'
import bannerImage from '../assets/images/banner.webp'
import dinnerChurchImage from '../assets/images/dinnerchurch.jpg'
import gebetImage from '../assets/images/gebet.jpg'
import parkplatzImage from '../assets/images/parkplatz.jpg'
import leiterImage from '../assets/images/leiter.jpg'

export function HomePage() {
    const [offers, setOffers] = useState<OfferSummary[] | null>(null)

    useEffect(() => {
        fetch('/api/offers')
            .then((res) => res.json() as Promise<OfferSummary[]>)
            .then(setOffers)
            .catch(() => setOffers([]))
    }, [])

    return (
        <div className={styles.home}>
            <section className={styles.hero} style={{ backgroundImage: `url(${bannerImage})` }}>
                <div className={styles.heroOverlay}>
                    <h1>Kirche Felsengrund</h1>
                    <p className={styles.heroTagline}>Kirche, die verändert</p>
                    <div className={styles.heroActions}>
                        <Link to="/angebote" className={styles.primaryButton}>Angebote entdecken</Link>
                        <Link to="/gottesdienst" className={styles.secondaryButton}>Gottesdienst</Link>
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.splitContent}>
                    <div>
                        <h2>Willkommen</h2>
                        <p>
                            Wir feiern jeden Sonntag um 9:45 Uhr Gottesdienst — mit Musik, einer Predigt und Zeit für
                            Gemeinschaft. Einmal im Monat laden wir zu einem besonderen Abend ein: der Dinner Church,
                            bei der wir gemeinsam essen, reden und Gott begegnen.
                        </p>
                        <a href="https://dinnerchurch.ch/" target="_blank" rel="noreferrer" className={styles.textLink}>
                            Mehr über Dinner Church →
                        </a>
                    </div>
                    <img src={dinnerChurchImage} alt="Dinner Church" className={styles.sectionImage} />
                </div>
            </section>

            <section className={styles.section}>
                <h2>Aktuelle Angebote</h2>
                <div className={offersStyles.grid}>
                    {offers?.slice(0, 3).map((offer) => (
                        <Link key={offer.guid} to={`/angebote/${offer.guid}`} className={offersStyles.card}>
                            {offer.cardImage && (
                                <img className={offersStyles.cardImage} src={offer.cardImage} alt={offer.title} />
                            )}
                            <div className={offersStyles.cardBody}>
                                <h3 className={offersStyles.cardTitle}>{offer.title}</h3>
                                <p className={offersStyles.cardIntro}>{offer.intro}</p>
                            </div>
                        </Link>
                    ))}
                    {offers?.length === 0 && <p>Aktuell sind keine Angebote verfügbar.</p>}
                </div>
                <Link to="/angebote" className={styles.textLink}>Alle Angebote ansehen →</Link>
            </section>

            <section className={styles.section}>
                <div className={styles.splitContent}>
                    <img src={gebetImage} alt="Gebetswand" className={styles.sectionImage} />
                    <div>
                        <h2>Gebetswand</h2>
                        <p>
                            Hast du ein Anliegen, für das wir beten dürfen? Teile es mit uns — anonym oder mit
                            deinem Namen.
                        </p>
                        <PrayerWallForm />
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.splitContent}>
                    <div>
                        <h2>Parkplatz</h2>
                        <p>Beim Parkplatz kannst du Gedanken, Fragen oder Feedback zur letzten Predigt loswerden.</p>
                        <FeedbackForm />
                    </div>
                    <img src={parkplatzImage} alt="Parkplatz" className={styles.sectionImage} />
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.splitContent}>
                    <img src={leiterImage} alt="Leitungsteam" className={styles.sectionImage} />
                    <div>
                        <h2>Über uns</h2>
                        <p>
                            Wir sind eine Kirchgemeinde, die Menschen jeden Alters und jeder Lebenssituation
                            willkommen heisst. Lerne unser Leitungsteam und unsere Werte kennen.
                        </p>
                        <Link to="/uber-uns" className={styles.textLink}>Mehr über uns →</Link>
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <h2>Hilfe & Service</h2>
                <p>Wir sind für dich da — egal in welcher Lebenslage.</p>
                <ul className={styles.linkList}>
                    <li><Link to="/angebote/lebensmittelabgabe">Lebensmittelabgabe</Link></li>
                    <li><Link to="/angebote/ich-brauche-hilfe">Ich brauche Hilfe</Link></li>
                </ul>
            </section>

            <footer className={styles.footer}>
                <p className={styles.footerName}>Kirche Felsengrund</p>
                <ul className={styles.footerLinks}>
                    <li><Link to="/kontakt">Kontakt & Spenden</Link></li>
                    <li><Link to="/angebote">Angebote</Link></li>
                    <li><Link to="/agenda">Agenda</Link></li>
                </ul>
                <p className={styles.footerCopy}>© {new Date().getFullYear()} Kirche Felsengrund</p>
            </footer>
        </div>
    )
}
