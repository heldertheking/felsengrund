import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import styles from '../Offers.module.css'
import { Offer } from '../../../types/types'
import { ImageUploadField } from './ImageUploadField.tsx'
import { OrganizerFields } from './OrganizerFields.tsx'
import { fromDatetimeLocal, toDatetimeLocal } from './datetimeLocal.ts'

interface Props {
    guid: string
    offer: Offer
    onChange: (offer: Offer) => void
}

export function OfferForm({ guid, offer, onChange }: Props) {
    return (
        <div className={styles.formGrid}>
            <div className={styles.formColumn}>
                <fieldset className={styles.fieldGroup}>
                    <legend>Grunddaten</legend>
                    <label className={styles.fieldLabel}>
                        Titel
                        <input value={offer.title} onChange={(event) => onChange({ ...offer, title: event.target.value })} />
                    </label>
                    <label className={styles.fieldLabel}>
                        Kurzbeschreibung (Intro)
                        <input value={offer.intro} onChange={(event) => onChange({ ...offer, intro: event.target.value })} />
                    </label>
                </fieldset>

                <fieldset className={styles.fieldGroup}>
                    <legend>Termin</legend>
                    <div className={styles.fieldRow}>
                        <label className={styles.fieldLabel}>
                            Start
                            <input
                                type="datetime-local"
                                value={toDatetimeLocal(offer.schedule.dtStart)}
                                onChange={(event) =>
                                    onChange({ ...offer, schedule: { ...offer.schedule, dtStart: fromDatetimeLocal(event.target.value) } })
                                }
                            />
                        </label>
                        <label className={styles.fieldLabel}>
                            Ende
                            <input
                                type="datetime-local"
                                value={toDatetimeLocal(offer.schedule.dtEnd)}
                                onChange={(event) =>
                                    onChange({ ...offer, schedule: { ...offer.schedule, dtEnd: fromDatetimeLocal(event.target.value) } })
                                }
                            />
                        </label>
                    </div>
                    <label className={styles.fieldLabel}>
                        Anzeige-Text (z.B. "Jeden Samstag, 14–17 Uhr")
                        <input
                            value={offer.schedule.displayTime}
                            onChange={(event) =>
                                onChange({ ...offer, schedule: { ...offer.schedule, displayTime: event.target.value } })
                            }
                        />
                    </label>
                    <label className={styles.fieldLabel}>
                        Wiederholungsregel (RRULE, optional, fortgeschritten)
                        <input
                            value={offer.schedule.rRule ?? ''}
                            onChange={(event) =>
                                onChange({ ...offer, schedule: { ...offer.schedule, rRule: event.target.value || undefined } })
                            }
                        />
                    </label>
                </fieldset>

                <fieldset className={styles.fieldGroup}>
                    <legend>Ort</legend>
                    <label className={styles.fieldLabel}>
                        Name
                        <input
                            value={offer.location.name}
                            onChange={(event) => onChange({ ...offer, location: { ...offer.location, name: event.target.value } })}
                        />
                    </label>
                    <label className={styles.fieldLabel}>
                        Adresse
                        <input
                            value={offer.location.address}
                            onChange={(event) => onChange({ ...offer, location: { ...offer.location, address: event.target.value } })}
                        />
                    </label>
                    <label className={styles.fieldLabel}>
                        Google-Maps-Link
                        <input
                            value={offer.location.mapsLink}
                            onChange={(event) => onChange({ ...offer, location: { ...offer.location, mapsLink: event.target.value } })}
                        />
                    </label>
                </fieldset>

                <fieldset className={styles.fieldGroup}>
                    <legend>Anmeldung</legend>
                    <label className={styles.checkboxLabel}>
                        <input
                            type="checkbox"
                            checked={offer.registration.required}
                            onChange={(event) =>
                                onChange({ ...offer, registration: { ...offer.registration, required: event.target.checked } })
                            }
                        />
                        Anmeldung erforderlich
                    </label>
                    {offer.registration.required && (
                        <label className={styles.fieldLabel}>
                            Anmeldeschluss
                            <input
                                type="datetime-local"
                                value={offer.registration.deadlineMs ? toDatetimeLocal(new Date(offer.registration.deadlineMs).toISOString()) : ''}
                                onChange={(event) =>
                                    onChange({
                                        ...offer,
                                        registration: {
                                            ...offer.registration,
                                            deadlineMs: event.target.value ? new Date(event.target.value).getTime() : undefined,
                                        },
                                    })
                                }
                            />
                        </label>
                    )}
                </fieldset>

                <fieldset className={styles.fieldGroup}>
                    <legend>Zielgruppe & Zeitraum</legend>
                    <div className={styles.fieldRow}>
                        <label className={styles.fieldLabel}>
                            Alter von
                            <input
                                type="number"
                                value={offer.meta.targetAudience.ageMin}
                                onChange={(event) =>
                                    onChange({
                                        ...offer,
                                        meta: { ...offer.meta, targetAudience: { ...offer.meta.targetAudience, ageMin: Number(event.target.value) } },
                                    })
                                }
                            />
                        </label>
                        <label className={styles.fieldLabel}>
                            Alter bis
                            <input
                                type="number"
                                value={offer.meta.targetAudience.ageMax}
                                onChange={(event) =>
                                    onChange({
                                        ...offer,
                                        meta: { ...offer.meta, targetAudience: { ...offer.meta.targetAudience, ageMax: Number(event.target.value) } },
                                    })
                                }
                            />
                        </label>
                    </div>
                    <div className={styles.fieldRow}>
                        <label className={styles.fieldLabel}>
                            Angeboten ab
                            <input
                                type="datetime-local"
                                value={toDatetimeLocal(offer.meta.offeredFrom)}
                                onChange={(event) =>
                                    onChange({ ...offer, meta: { ...offer.meta, offeredFrom: fromDatetimeLocal(event.target.value) } })
                                }
                            />
                        </label>
                        <label className={styles.fieldLabel}>
                            Angeboten bis (optional)
                            <input
                                type="datetime-local"
                                value={toDatetimeLocal(offer.meta.offeredUntil)}
                                onChange={(event) =>
                                    onChange({ ...offer, meta: { ...offer.meta, offeredUntil: event.target.value ? fromDatetimeLocal(event.target.value) : undefined } })
                                }
                            />
                        </label>
                    </div>
                    <label className={styles.fieldLabel}>
                        Verantwortlich (Autor)
                        <input value={offer.meta.author} onChange={(event) => onChange({ ...offer, meta: { ...offer.meta, author: event.target.value } })} />
                    </label>
                    {offer.meta.createdAt && (
                        <p className={styles.readOnlyHint}>Erstellt am {new Date(offer.meta.createdAt).toLocaleString('de-CH')}</p>
                    )}
                </fieldset>
            </div>

            <div className={styles.formColumn}>
                <fieldset className={styles.fieldGroup}>
                    <legend>Bilder</legend>
                    <ImageUploadField guid={guid} label="Hauptbild" value={offer.image} onChange={(url) => onChange({ ...offer, image: url })} />
                    <ImageUploadField
                        guid={guid}
                        label="Karten-Bild (Angebotsübersicht)"
                        value={offer.meta.cardImage}
                        onChange={(url) => onChange({ ...offer, meta: { ...offer.meta, cardImage: url } })}
                    />
                    <div className={styles.galleryField}>
                        <span className={styles.fieldLabel}>Galerie</span>
                        <div className={styles.galleryGrid}>
                            {offer.gallery.map((url, index) => (
                                <div key={url + index} className={styles.galleryItem}>
                                    <img src={url} alt="" />
                                    <button
                                        type="button"
                                        onClick={() => onChange({ ...offer, gallery: offer.gallery.filter((_, i) => i !== index) })}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                        <ImageUploadField
                            guid={guid}
                            label="Bild zur Galerie hinzufügen"
                            value=""
                            onChange={(url) => url && onChange({ ...offer, gallery: [...offer.gallery, url] })}
                        />
                    </div>
                </fieldset>

                <fieldset className={styles.fieldGroup}>
                    <legend>Organisation</legend>
                    <OrganizerFields organizers={offer.organizers} onChange={(organizers) => onChange({ ...offer, organizers })} />
                </fieldset>

                <fieldset className={styles.fieldGroup}>
                    <legend>Beschreibung</legend>
                    <div className={styles.descriptionEditor}>
                        <textarea
                            className={styles.editorTextarea}
                            value={offer.description}
                            onChange={(event) => onChange({ ...offer, description: event.target.value })}
                        />
                        <div className={styles.editorPreview}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{offer.description || '*Vorschau erscheint hier*'}</ReactMarkdown>
                        </div>
                    </div>
                </fieldset>
            </div>
        </div>
    )
}
