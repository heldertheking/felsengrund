import { stringify as stringifyYaml } from 'yaml';

// Mirrors api-core's joinFrontmatter so exports re-import byte-for-byte. Duplicated (not
// imported) so the public web bundle doesn't pull in API-only code.
export function toMdoc(data: Record<string, unknown>, body: string): string {
  const yaml = stringifyYaml(data, { lineWidth: 0 }).trim();
  return `---\n${yaml}\n---\n\n${body.trim()}\n`;
}

// Filters out non-.mdoc files (accept=".mdoc" steers the picker, but drag-and-drop can bypass it).
export function filterMdocFiles(files: File[]): File[] {
  return files.filter((file) => file.name.toLowerCase().endsWith('.mdoc'));
}
