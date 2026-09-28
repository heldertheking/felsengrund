import { zipSync, type Zippable } from 'fflate';
import { toMdoc } from './mdoc';

export interface ExportableEntry {
  slug: string;
  data: Record<string, unknown>;
  body: string;
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Downloads selected rows as .mdoc (same format the import button reads). A single row
// downloads directly; multiple are zipped, since browsers can't fire several downloads at once.
export function downloadMdocExport(filenamePrefix: string, entries: ExportableEntry[]): void {
  if (entries.length === 0) return;

  if (entries.length === 1) {
    const [entry] = entries;
    downloadBlob(`${entry.slug}.mdoc`, new Blob([toMdoc(entry.data, entry.body)], { type: 'text/markdown' }));
    return;
  }

  const files: Zippable = {};
  for (const entry of entries) {
    files[`${entry.slug}.mdoc`] = new TextEncoder().encode(toMdoc(entry.data, entry.body));
  }

  const date = new Date().toISOString().slice(0, 10);
  const zipped = zipSync(files);
  downloadBlob(`${filenamePrefix}-${date}.zip`, new Blob([zipped], { type: 'application/zip' }));
}
