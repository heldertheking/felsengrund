import styles from './Header.module.css'
import {Link} from "react-router-dom";
import {useEffect, useState} from "react";

import bannerImg from '../../../assets/banner.webp'
import {Dropdown} from "../../ui/Dropdown/Dropdown.tsx";

export function Header() {
    const [isBannerHidden, setIsBannerHidden] = useState(false)

    useEffect(() => {
        const updateBannerVisibility = () => {
            setIsBannerHidden(window.scrollY > 24)
        }

        updateBannerVisibility()
        window.addEventListener('scroll', updateBannerVisibility, {passive: true})

        return () => window.removeEventListener('scroll', updateBannerVisibility)
    }, [])

    return (
        <header className={styles.header}>
            <div
                className={`${styles.banner} ${isBannerHidden ? styles.bannerHidden : ''}`}
                aria-label="Banner image container"
                aria-hidden={isBannerHidden}
            >
                <img src={bannerImg} alt="Banner" className={styles.image_banner}/>
            </div>
            <nav aria-label="Main navigation" className={styles.navigation} role="navigation">
                <ul className={styles.navList}>
                    <li><Link to="/">Home</Link></li>
                    <li><Link to="/ueber-uns">Über uns</Link></li>
                    <li><Link to="/agenda">Agenda</Link></li>
                    <li>
                        <Dropdown title="Angebote" openOn="hover" position="bottom" titleHref="/angebote">
                            <ul className={styles.dropdownContent}>
                                <section>
                                    <span>Gottesdienst</span>
                                    <li><Link to="/gottesdienst">Gottesdienst</Link></li>
                                    <li><Link to="https://dinnerchurch.ch/">Dinner Church</Link></li>
                                </section>
                                <section>
                                    <span>Jugend & Kinder</span>
                                    <li><Link to="/angebote/kids-treff">Kids-Treff</Link></li>
                                    <li><Link to="/angebote/jungschar">Jungschar</Link></li>
                                    <li><Link to="/angebote/highlight">Highlight</Link></li>
                                </section>
                                <section>
                                    <span>Gemeinschaft</span>
                                    <li><Link to="/angebote/smallgroups">Smallgroups</Link></li>
                                    <li><Link to="/angebote/bibel-unterricht">Bibel Unterricht</Link></li>
                                </section>
                                <section>
                                    <span>Senioren</span>
                                    <li><Link to="/angebote/senioren">Senioren</Link></li>
                                    <li><Link to="/angebote/senioren-essen">Senioren Essen 60+</Link></li>
                                </section>
                                <section>
                                    <span>Hilfe & Service</span>
                                    <li><Link to="/angebote/lebensmittelabgabe">Lebensmittelabgabe</Link></li>
                                    <li><Link to="/angebote/ich-brauche-hilfe">Ich brauche Hilfe</Link></li>
                                </section>
                                <section>
                                    <span>Weitere</span>
                                    <li><Link to="/angebote/human-flourishing">Human Flourishing</Link></li>
                                </section>
                            </ul>
                        </Dropdown></li>
                    <li><Link to="/kontakt">Kontakt & Spenden</Link></li>
                </ul>
            </nav>
        </header>
    )
}