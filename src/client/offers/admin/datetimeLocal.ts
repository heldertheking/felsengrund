/** Converts an ISO 8601 UTC string to the value a `<input type="datetime-local">` expects. */
export function toDatetimeLocal(iso: string | undefined): string {
    if (!iso) return ''
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Converts a `<input type="datetime-local">` value back to an ISO 8601 UTC string. */
export function fromDatetimeLocal(value: string): string {
    if (!value) return new Date().toISOString()
    return new Date(value).toISOString()
}
