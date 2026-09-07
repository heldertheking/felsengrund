import { FormEvent, useState } from 'react'
import styles from './Home.module.css'

export function FeedbackForm() {
    const [message, setMessage] = useState('')
    const [name, setName] = useState('')
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

    async function handleSubmit(event: FormEvent) {
        event.preventDefault()
        setStatus('sending')
        try {
            const res = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ message, name: name.trim() || undefined }),
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
        return <p className={styles.formSuccess}>Danke für dein Feedback!</p>
    }

    return (
        <form className={styles.form} onSubmit={handleSubmit}>
            <textarea
                required
                placeholder="Deine Gedanken zur letzten Predigt..."
                value={message}
                onChange={(event) => setMessage(event.target.value)}
            />
            <input
                placeholder="Dein Name (optional)"
                value={name}
                onChange={(event) => setName(event.target.value)}
            />
            {status === 'error' && <p className={styles.formError}>Das hat leider nicht geklappt. Bitte versuche es erneut.</p>}
            <button type="submit" disabled={status === 'sending' || !message.trim()}>Absenden</button>
        </form>
    )
}
