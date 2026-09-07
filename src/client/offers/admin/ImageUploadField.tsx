import { ChangeEvent, useRef, useState } from 'react'
import styles from '../Offers.module.css'

interface Props {
    guid: string
    value: string
    onChange: (url: string) => void
    label: string
}

/**
 * Uploads directly to the existing `/api/admin/offers/:guid/images` endpoint, which accepts a raw
 * file body — a `File` works as-is as a fetch body, no multipart/form-data needed.
 */
export function ImageUploadField({ guid, value, onChange, label }: Props) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return

        setIsUploading(true)
        setError(null)
        try {
            const res = await fetch(`/api/admin/offers/${guid}/images`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'content-type': file.type || 'application/octet-stream' },
                body: file,
            })
            if (!res.ok) throw new Error('Upload failed')
            const data = (await res.json()) as { url: string }
            onChange(data.url)
        } catch {
            setError('Hochladen fehlgeschlagen.')
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <div className={styles.imageField}>
            <span className={styles.fieldLabel}>{label}</span>
            {value && <img src={value} alt="" className={styles.imagePreview} />}
            <div className={styles.imageFieldActions}>
                <button type="button" onClick={() => inputRef.current?.click()} disabled={isUploading}>
                    {isUploading ? 'Lädt hoch...' : value ? 'Bild ersetzen' : 'Bild hochladen'}
                </button>
                {value && (
                    <button type="button" onClick={() => onChange('')}>
                        Entfernen
                    </button>
                )}
            </div>
            <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFileChange} />
            {error && <p className={styles.editorError}>{error}</p>}
        </div>
    )
}
