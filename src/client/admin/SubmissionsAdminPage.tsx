import { useCallback, useEffect, useState } from 'react'
import styles from './Admin.module.css'
import { Submission } from '../../types/types'

interface Props {
    title: string
    /** URL path segment, e.g. "prayer-wall" or "feedback" — matches the worker's routes. */
    path: string
}

export function SubmissionsAdminPage({ title, path }: Props) {
    const [items, setItems] = useState<Submission[] | null>(null)

    const load = useCallback(async () => {
        const res = await fetch(`/api/admin/${path}`, { credentials: 'include' })
        setItems((await res.json()) as Submission[])
    }, [path])

    useEffect(() => {
        load()
    }, [load])

    async function handleDelete(id: string) {
        await fetch(`/api/admin/${path}/${id}`, { method: 'DELETE', credentials: 'include' })
        await load()
    }

    return (
        <section className={styles.page}>
            <header className={styles.header}>
                <h1>{title}</h1>
            </header>

            {items === null && <p>Lade...</p>}
            {items?.length === 0 && <p>Noch keine Einträge.</p>}

            <ul className={styles.list}>
                {items?.map((item) => (
                    <li key={item.id} className={styles.item}>
                        <div>
                            <p className={styles.message}>{item.message}</p>
                            <span className={styles.meta}>
                                {item.name || 'Anonym'}
                                {item.isAnonymous && ' (möchte anonym bleiben)'}
                                {' · '}
                                {new Date(item.createdAt).toLocaleString('de-CH')}
                            </span>
                        </div>
                        <button onClick={() => handleDelete(item.id)}>Löschen</button>
                    </li>
                ))}
            </ul>
        </section>
    )
}
