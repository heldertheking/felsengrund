import styles from './Header.module.css'
import {Link} from "react-router-dom";
import LogoSvg from '../../../assets/icons/logo_full_single_transparent.svg'
import {Dropdown} from "../../ui/Dropdown/Dropdown.tsx";
import {useAdminAuth} from "../../../contexts/AdminAuthContext.tsx";
import {useSecretClickTrigger} from "../../admin/useSecretClickTrigger.ts";

export function Header() {
    const {openLoginModal} = useAdminAuth()
    const handleLogoClick = useSecretClickTrigger(openLoginModal)

    return (
        <header className={styles.header}>
            <Link to="/" className={styles.logo} onClick={handleLogoClick}>
                <img src={LogoSvg} alt="Logo" aria-label="Logo"/>
            </Link>
            <nav aria-label="Main navigation" className={styles.navigation} role="navigation">
                <ul className={styles.navList}>
                    <li><Link to="/">Home</Link></li>
                    <li><Link to="/uber-uns">Über uns</Link></li>
                    <li><Link to="/agenda">Agenda</Link></li>
                    <li>
                        <Dropdown title="Angebote" openOn="hover" position="bottom" titleHref="/angebote">
                            <ul className={styles.dropdownContent}>
                                <section>
                                    <span>Gottesdienst</span>
                                    <li><Link to="/gottesdienst">Gottesdienst</Link></li>
                                    <li><Link to="https://dinnerchurch.ch/">Dinner Church</Link></li>
                                    <li><Link to="/angebote/podcast">Podcast</Link></li>
                                </section>
                                <section>
                                    <span>Kinder & Jugend</span>
                                    <li><Link to="/angebote/kids-treff">Kids-Treff</Link></li>
                                    <li><Link to="/angebote/jungschar">Jungschar</Link></li>
                                    <li><Link to="/angebote/highlight">Highlight</Link></li>
                                </section>
                                <section>
                                    <span>Gemeinschaft</span>
                                    <li><Link to="/angebote/smallgroups">Smallgroups/Hauskreise</Link></li>
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