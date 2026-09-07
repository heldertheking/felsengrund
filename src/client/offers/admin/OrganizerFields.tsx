import styles from '../Offers.module.css'
import { Organizer } from '../../../types/types'

interface Props {
    organizers: Organizer[]
    onChange: (organizers: Organizer[]) => void
}

export function OrganizerFields({ organizers, onChange }: Props) {
    function updateOrganizer(index: number, patch: Partial<Organizer>) {
        onChange(organizers.map((organizer, i) => (i === index ? { ...organizer, ...patch } : organizer)))
    }

    function removeOrganizer(index: number) {
        onChange(organizers.filter((_, i) => i !== index))
    }

    return (
        <div className={styles.organizerFields}>
            {organizers.map((organizer, index) => (
                <div key={index} className={styles.organizerRow}>
                    <input
                        placeholder="Name"
                        value={organizer.name}
                        onChange={(event) => updateOrganizer(index, { name: event.target.value })}
                    />
                    <input
                        placeholder="Rolle"
                        value={organizer.role ?? ''}
                        onChange={(event) => updateOrganizer(index, { role: event.target.value })}
                    />
                    <input
                        placeholder="E-Mail"
                        value={organizer.email ?? ''}
                        onChange={(event) => updateOrganizer(index, { email: event.target.value })}
                    />
                    <input
                        placeholder="Telefon"
                        value={organizer.phone ?? ''}
                        onChange={(event) => updateOrganizer(index, { phone: event.target.value })}
                    />
                    <input
                        placeholder="Bild-URL"
                        value={organizer.image}
                        onChange={(event) => updateOrganizer(index, { image: event.target.value })}
                    />
                    <button type="button" onClick={() => removeOrganizer(index)}>Entfernen</button>
                </div>
            ))}
            <button type="button" onClick={() => onChange([...organizers, { name: '', image: '' }])}>
                + Person hinzufügen
            </button>
        </div>
    )
}
