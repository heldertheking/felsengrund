import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './LoginModal.module.css'
import { useAdminAuth } from '../../contexts/AdminAuthContext.tsx'

export function LoginModal() {
    const { isLoginModalOpen, closeLoginModal, login } = useAdminAuth()
    const navigate = useNavigate()
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    if (!isLoginModalOpen) return null

    async function handleSubmit(event: FormEvent) {
        event.preventDefault()
        setIsSubmitting(true)
        setError(null)
        const success = await login(password)
        setIsSubmitting(false)
        if (success) {
            setPassword('')
            navigate('/admin')
        } else {
            setError('Falsches Passwort')
        }
    }

    return (
        <div className={styles.overlay} onClick={closeLoginModal}>
            <form className={styles.modal} onClick={(event) => event.stopPropagation()} onSubmit={handleSubmit}>
                <h2>Admin-Login</h2>
                <input
                    type="password"
                    autoFocus
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Passwort"
                />
                {error && <p className={styles.error}>{error}</p>}
                <div className={styles.actions}>
                    <button type="button" onClick={closeLoginModal}>Abbrechen</button>
                    <button type="submit" disabled={isSubmitting || !password}>Anmelden</button>
                </div>
            </form>
        </div>
    )
}
