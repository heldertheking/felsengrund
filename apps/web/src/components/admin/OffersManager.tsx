import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { apiClient } from '../../lib/api'
import { CATEGORY_DETAILS, UnauthorizedError, type Offer, type OfferFrontmatter, type OfferOrganizer } from '@felsengrund/types'
import { downloadMdocExport } from '../../lib/export'

const CATEGORIES: { value: OfferFrontmatter['category']; label: string }[] = Object.entries(CATEGORY_DETAILS)
  .sort((a, b) => a[1].index - b[1].index)
  .map(([value, details]) => ({ value: value as OfferFrontmatter['category'], label: details.label }))

const inputClass =
  'mt-1 w-full rounded-lg border border-kf-edge bg-kf-surface px-3 py-2 text-sm text-kf-ink focus:border-kf-accent focus:outline-none focus:ring-1 focus:ring-kf-accent'
const labelClass = 'text-xs font-semibold uppercase tracking-wide text-kf-ink-muted'

interface Props {
  onUnauthorized: () => void
}

type Mode = { view: 'list' } | { view: 'form'; offer: Offer | null }

export default function OffersManager({ onUnauthorized }: Props) {
  const [offers, setOffers] = useState<Offer[] | null>(null)
  const [mode, setMode] = useState<Mode>({ view: 'list' })
  const [listError, setListError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  function reload() {
    apiClient.offers
      .list()
      .then((data) => {
        setOffers(data)
        setSelected((prev) => new Set([...prev].filter((slug) => data.some((o) => o.slug === slug))))
      })
      .catch(() => setListError('Angebote konnten nicht geladen werden.'))
  }

  useEffect(() => {
    reload()
  }, [])

  function toggleSelected(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  function toggleSelectAll() {
    if (!offers) return
    setSelected((prev) => (prev.size === offers.length ? new Set() : new Set(offers.map((o) => o.slug))))
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return
    if (!confirm(`${selected.size} Angebot(e) wirklich löschen?`)) return
    setBulkBusy(true)
    try {
      for (const slug of selected) {
        await apiClient.offers.delete(slug)
      }
      setSelected(new Set())
      reload()
    } catch (err) {
      if (err instanceof UnauthorizedError) return onUnauthorized()
      alert(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.')
    } finally {
      setBulkBusy(false)
    }
  }

  function handleBulkExport() {
    if (!offers) return
    const rows = offers
      .filter((o) => selected.has(o.slug))
      .map((o) => ({ slug: o.slug, data: o.data as unknown as Record<string, unknown>, body: o.body }))
    downloadMdocExport('angebote-export', rows)
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setImporting(true)
    setImportError(null)
    try {
      await apiClient.offers.importMdoc(file)
      reload()
    } catch (err) {
      if (err instanceof UnauthorizedError) return onUnauthorized()
      setImportError(err instanceof Error ? err.message : 'Import fehlgeschlagen.')
    } finally {
      setImporting(false)
    }
  }

  if (mode.view === 'form') {
    return (
      <OfferForm
        offer={mode.offer}
        onDone={() => {
          setMode({ view: 'list' })
          reload()
        }}
        onUnauthorized={onUnauthorized}
      />
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-kf-ink">Angebote</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="rounded-lg border border-kf-edge px-4 py-2 text-sm font-semibold text-kf-ink transition hover:border-kf-accent hover:text-kf-accent disabled:opacity-50"
          >
            {importing ? 'Wird importiert …' : 'Importieren'}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".mdoc"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => setMode({ view: 'form', offer: null })}
            className="rounded-lg bg-kf-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Neues Angebot
          </button>
        </div>
      </div>

      {importError && <p className="mt-4 text-sm text-red-700">{importError}</p>}
      {listError && <p className="mt-4 text-sm text-red-700">{listError}</p>}
      {!offers && !listError && <p className="mt-4 text-sm text-kf-ink-muted">Wird geladen …</p>}

      {offers && offers.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2 text-kf-ink-muted">
            <input
              type="checkbox"
              checked={selected.size === offers.length}
              onChange={toggleSelectAll}
              className="rounded border-kf-edge"
            />
            Alle auswählen
          </label>
          {selected.size > 0 && (
            <>
              <span className="text-kf-ink-muted">{selected.size} ausgewählt</span>
              <button
                type="button"
                onClick={handleBulkExport}
                className="rounded-lg border border-kf-edge px-3 py-1.5 text-xs font-semibold text-kf-ink transition hover:border-kf-accent hover:text-kf-accent"
              >
                Exportieren
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={handleBulkDelete}
                className="rounded-lg border border-red-600 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                Löschen
              </button>
            </>
          )}
        </div>
      )}

      {offers && (
        <ul className="mt-4 divide-y divide-kf-edge border-y border-kf-edge">
          {offers.map((offer) => (
            <li key={offer.slug} className="flex items-center justify-between gap-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(offer.slug)}
                  onChange={() => toggleSelected(offer.slug)}
                  className="shrink-0 rounded border-kf-edge"
                />
                <div className="min-w-0">
                  <p className="truncate font-medium text-kf-ink">{offer.data.title}</p>
                  <p className="text-xs text-kf-ink-muted">{offer.slug}</p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setMode({ view: 'form', offer })}
                  className="rounded-lg border border-kf-edge px-3 py-1.5 text-xs font-semibold text-kf-ink transition hover:border-kf-accent hover:text-kf-accent"
                >
                  Bearbeiten
                </button>
                <DeleteButton slug={offer.slug} onDeleted={reload} onUnauthorized={onUnauthorized} />
              </div>
            </li>
          ))}
          {offers.length === 0 && <li className="py-3 text-sm text-kf-ink-muted">Noch keine Angebote.</li>}
        </ul>
      )}
    </div>
  )
}

function DeleteButton({
  slug,
  onDeleted,
  onUnauthorized,
}: {
  slug: string
  onDeleted: () => void
  onUnauthorized: () => void
}) {
  const [busy, setBusy] = useState(false)

  async function handleClick() {
    if (!confirm('Dieses Angebot wirklich löschen?')) return
    setBusy(true)
    try {
      await apiClient.offers.delete(slug)
      onDeleted()
    } catch (err) {
      if (err instanceof UnauthorizedError) return onUnauthorized()
      alert(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={handleClick}
      className="rounded-lg border border-red-600 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
    >
      Löschen
    </button>
  )
}

function OfferForm({
  offer,
  onDone,
  onUnauthorized,
}: {
  offer: Offer | null
  onDone: () => void
  onUnauthorized: () => void
}) {
  const isEdit = offer !== null
  const [title, setTitle] = useState(offer?.data.title ?? '')
  const [intro, setIntro] = useState(offer?.data.intro ?? '')
  const [category, setCategory] = useState<OfferFrontmatter['category']>(offer?.data.category ?? 'gottesdienst')
  const [targetAudience, setTargetAudience] = useState(offer?.data.targetAudience ?? '')
  const [schedule, setSchedule] = useState(offer?.data.schedule ?? '')
  const [location, setLocation] = useState(offer?.data.location ?? '')
  const [mapsLink, setMapsLink] = useState(offer?.data.mapsLink ?? '')
  const [registration, setRegistration] = useState(offer?.data.registration ?? '')
  const [organizers, setOrganizers] = useState<OfferOrganizer[]>(offer?.data.organizers ?? [])
  const [cardImage, setCardImage] = useState<File | null>(null)
  const [body, setBody] = useState(offer?.body ?? '')
  const [status, setStatus] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function updateOrganizer(index: number, field: keyof OfferOrganizer, value: string) {
    setOrganizers((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('Wird gespeichert …')
    setSubmitting(true)

    try {
      const input = {
        title,
        intro,
        category,
        targetAudience,
        schedule,
        location,
        mapsLink,
        registration,
        organizers: organizers.filter((o) => o.name.trim()),
        body,
        cardImage: cardImage ?? undefined,
      }

      if (isEdit) {
        await apiClient.offers.update(offer.slug, input)
      } else {
        await apiClient.offers.create(input)
      }
      onDone()
    } catch (err) {
      if (err instanceof UnauthorizedError) return onUnauthorized()
      setStatus(err instanceof Error ? err.message : 'Da ist etwas schiefgelaufen.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-kf-ink">
          {isEdit ? 'Angebot bearbeiten' : 'Neues Angebot'}
        </h2>
        <button type="button" onClick={onDone} className="text-sm text-kf-ink-muted hover:text-kf-accent">
          Zurück zur Liste
        </button>
      </div>

      <div>
        <label className={labelClass}>Titel</label>
        <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        {isEdit && (
          <p className="mt-1 text-xs text-kf-ink-muted">
            Slug: <code>{offer.slug}</code>
          </p>
        )}
      </div>

      <div>
        <label className={labelClass}>Intro</label>
        <textarea rows={2} value={intro} onChange={(e) => setIntro(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>Kategorie</label>
        <select value={category} onChange={(e) => setCategory(e.target.value as OfferFrontmatter['category'])} className={inputClass}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Zielgruppe</label>
        <input type="text" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>Zeiten</label>
        <input type="text" value={schedule} onChange={(e) => setSchedule(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>Ort</label>
        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>Google-Maps-Link</label>
        <input type="url" value={mapsLink} onChange={(e) => setMapsLink(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>Anmeldung</label>
        <input type="text" value={registration} onChange={(e) => setRegistration(e.target.value)} className={inputClass} />
      </div>

      <div>
        <span className={labelClass}>Ansprechpersonen</span>
        <div className="mt-2 flex flex-col gap-2">
          {organizers.map((organizer, index) => (
            <div key={index} className="grid grid-cols-1 gap-2 rounded-lg border border-kf-edge p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center">
              <input
                type="text"
                placeholder="Name"
                value={organizer.name}
                onChange={(e) => updateOrganizer(index, 'name', e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="Rolle"
                value={organizer.role ?? ''}
                onChange={(e) => updateOrganizer(index, 'role', e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="Kontakt"
                value={organizer.contact ?? ''}
                onChange={(e) => updateOrganizer(index, 'contact', e.target.value)}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setOrganizers((rows) => rows.filter((_, i) => i !== index))}
                className="justify-self-start rounded-lg border border-kf-edge px-3 py-2 text-xs font-semibold text-kf-ink-muted transition hover:border-red-600 hover:text-red-600 sm:justify-self-center"
              >
                Entfernen
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setOrganizers((rows) => [...rows, { name: '' }])}
          className="mt-2 rounded-lg border border-kf-edge px-3 py-1.5 text-xs font-semibold text-kf-ink transition hover:border-kf-accent hover:text-kf-accent"
        >
          Ansprechperson hinzufügen
        </button>
      </div>

      <div>
        <label className={labelClass}>Kartenbild</label>
        {offer?.data.cardImage && (
          <img src={offer.data.cardImage} alt="" className="mt-2 h-24 w-auto rounded-lg border border-kf-edge object-cover" />
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setCardImage(e.target.files?.[0] ?? null)}
          className="mt-1 w-full rounded-lg border border-kf-edge bg-kf-surface px-3 py-2 text-sm text-kf-ink file:mr-3 file:rounded-md file:border-0 file:bg-kf-accent file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
        />
      </div>

      <div>
        <label className={labelClass}>Inhalt (Markdoc)</label>
        <textarea rows={14} value={body} onChange={(e) => setBody(e.target.value)} className={`${inputClass} font-mono`} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-kf-accent px-5 py-2.5 font-display text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          Speichern
        </button>
        {status && <p className="text-sm text-kf-ink-muted">{status}</p>}
      </div>
    </form>
  )
}
