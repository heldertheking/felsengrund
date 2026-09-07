import { ReactNode } from 'react'
import { Navigate, NavLink } from 'react-router-dom'
import styles from './RequireAdmin.module.css'
import { useAdminAuth } from '../../contexts/AdminAuthContext.tsx'

export function RequireAdmin({ children }: { children: ReactNode }) {
    const { isAuthenticated, isChecking, logout } = useAdminAuth()

    if (isChecking) return null
    if (!isAuthenticated) return <Navigate to="/" replace />

    return (
        <div className={styles.shell}>
            <nav className={styles.nav}>
                <NavLink to="/admin" end className={({ isActive }) => (isActive ? styles.activeLink : undefined)}>
                    Angebote
                </NavLink>
                <NavLink to="/admin/prayer-wall" className={({ isActive }) => (isActive ? styles.activeLink : undefined)}>
                    Gebetswand
                </NavLink>
                <NavLink to="/admin/feedback" className={({ isActive }) => (isActive ? styles.activeLink : undefined)}>
                    Parkplatz
                </NavLink>
                <button className={styles.logoutButton} onClick={() => logout()}>Abmelden</button>
            </nav>
            <div className={styles.content}>{children}</div>
        </div>
    )
}
