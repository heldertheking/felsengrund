import { stringify as stringifyYaml } from 'yaml'

// Mirrors packages/api-core's joinFrontmatter so an export can be re-imported byte-for-byte
// through the admin dashboard's .mdoc import. Kept here (rather than importing api-core) so the
// public web bundle doesn't pull in API-only code (admin auth, n8n notify, etc.).
export function toMdoc(data: Record<string, unknown>, body: string): string {
  const yaml = stringifyYaml(data, { lineWidth: 0 }).trim()
  return `---\n${yaml}\n---\n\n${body.trim()}\n`
}
