import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import styles from '../Offers.module.css'
import { Offer } from '../../../types/types'
import { parseOfferMarkdown, serializeOffer } from '../../../shared/offerMarkdown'
import { OfferForm } from './OfferForm.tsx'

export function OfferEditPage() {
    const { guid: routeGuid } = useParams<{ guid: string }>()
    const navigate = useNavigate()

    const [guid, setGuid] = useState<string | null>(null)
    const [offer, setOffer] = useState<Offer | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        setIsLoading(true)
        fetch(`/api/admin/offers/${routeGuid}`, { credentials: 'include' })
            .then((res) => res.json() as Promise<{ guid: string; raw: string }>)
            .then((data) => {
                if (cancelled) return
                setGuid(data.guid)
                setOffer(parseOfferMarkdown(data.guid, data.raw))
            })
            .catch(() => !cancelled && setError('Angebot konnte nicht geladen werden.'))
            .finally(() => !cancelled && setIsLoading(false))
        return () => {
            cancelled = true
        }
    }, [routeGuid])

    async function handleSave() {
        if (!guid || !offer) return
        setIsSaving(true)
        setError(null)
        try {
            const res = await fetch(`/api/admin/offers/${guid}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'content-type': 'text/markdown; charset=utf-8' },
                body: serializeOffer(offer),
            })
            if (!res.ok) throw new Error('Save failed')
            navigate('/admin')
        } catch {
            setError('Speichern fehlgeschlagen. Bitte alle Felder prüfen.')
        } finally {
            setIsSaving(false)
        }
    }

    async function handleDelete() {
        if (!guid || routeGuid === 'new') return
        if (!confirm('Dieses Angebot wirklich löschen?')) return
        await fetch(`/api/admin/offers/${guid}`, { method: 'DELETE', credentials: 'include' })
        navigate('/admin')
    }

    if (isLoading) return <p>Lade...</p>
    if (!offer || !guid) return <p>{error ?? 'Angebot konnte nicht geladen werden.'}</p>

    return (
        <section className={styles.editorPage}>
            <header className={styles.adminHeader}>
                <h1>{routeGuid === 'new' ? 'Neues Angebot' : 'Angebot bearbeiten'}</h1>
                <div className={styles.adminHeaderActions}>
                    {routeGuid !== 'new' && <button onClick={handleDelete}>Löschen</button>}
                    <button onClick={handleSave} disabled={isSaving || !offer.title.trim()}>Speichern</button>
                </div>
            </header>

            {error && <p className={styles.editorError}>{error}</p>}

            <OfferForm guid={guid} offer={offer} onChange={setOffer} />
        </section>
    )
}
