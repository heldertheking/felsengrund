import { stringify as stringifyYaml } from 'yaml'

// Mirrors packages/api-core's joinFrontmatter so an export can be re-imported byte-for-byte
// through the admin dashboard's .mdoc import. Kept here (rather than importing api-core) so the
// public web bundle doesn't pull in API-only code (admin auth, n8n notify, etc.).
export function toMdoc(data: Record<string, unknown>, body: string): string {
  const yaml = stringifyYaml(data, { lineWidth: 0 }).trim()
  return `---\n${yaml}\n---\n\n${body.trim()}\n`
}

// Bulk import lets the file picker return several files at once — this just filters out
// anything that isn't a .mdoc file (accept=".mdoc" already steers the picker, but drag-and-drop
// or a loose OS file dialog can still hand back other types).
export function filterMdocFiles(files: File[]): File[] {
  return files.filter((file) => file.name.toLowerCase().endsWith('.mdoc'))
}
