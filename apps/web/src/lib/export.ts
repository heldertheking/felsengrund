import { zipSync, type Zippable } from 'fflate'
import { toMdoc } from './mdoc'

export interface ExportableEntry {
  slug: string
  data: Record<string, unknown>
  body: string
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

// Triggers a browser download of the selected admin-dashboard rows as .mdoc — the same format
// the import button reads, so an export can be re-imported directly. A single selected row
// downloads as `<slug>.mdoc`; multiple rows are bundled into one `<prefix>-<date>.zip` (each
// entry still a plain `<slug>.mdoc`) since browsers can't reliably fire several downloads from
// one click.
export function downloadMdocExport(filenamePrefix: string, entries: ExportableEntry[]): void {
  if (entries.length === 0) return

  if (entries.length === 1) {
    const [entry] = entries
    downloadBlob(`${entry.slug}.mdoc`, new Blob([toMdoc(entry.data, entry.body)], { type: 'text/markdown' }))
    return
  }

  const files: Zippable = {}
  for (const entry of entries) {
    files[`${entry.slug}.mdoc`] = new TextEncoder().encode(toMdoc(entry.data, entry.body))
  }

  const date = new Date().toISOString().slice(0, 10)
  const zipped = zipSync(files)
  downloadBlob(`${filenamePrefix}-${date}.zip`, new Blob([zipped], { type: 'application/zip' }))
}
