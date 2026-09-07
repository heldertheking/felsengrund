import { FormEvent, useState } from 'react'
import styles from './Home.module.css'

export function PrayerWallForm() {
    const [message, setMessage] = useState('')
    const [name, setName] = useState('')
    const [isAnonymous, setIsAnonymous] = useState(true)
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

    async function handleSubmit(event: FormEvent) {
        event.preventDefault()
        setStatus('sending')
        try {
            const res = await fetch('/api/prayer-wall', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ message, name: isAnonymous ? undefined : name || undefined, isAnonymous }),
            })
            if (!res.ok) throw new Error('Request failed')
            setMessage('')
            setName('')
            setStatus('sent')
        } catch {
            setStatus('error')
        }
    }

    if (status === 'sent') {
        return <p className={styles.formSuccess}>Danke, dein Gebetsanliegen wurde weitergegeben.</p>
    }

    return (
        <form className={styles.form} onSubmit={handleSubmit}>
            <textarea
                required
                placeholder="Dein Gebetsanliegen..."
                value={message}
                onChange={(event) => setMessage(event.target.value)}
            />
            <label className={styles.checkboxLabel}>
                <input type="checkbox" checked={isAnonymous} onChange={(event) => setIsAnonymous(event.target.checked)} />
                Anonym posten
            </label>
            {!isAnonymous && (
                <input
                    placeholder="Dein Name (optional)"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                />
            )}
            {status === 'error' && <p className={styles.formError}>Das hat leider nicht geklappt. Bitte versuche es erneut.</p>}
            <button type="submit" disabled={status === 'sending' || !message.trim()}>Absenden</button>
        </form>
    )
}
