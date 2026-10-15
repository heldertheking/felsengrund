/**
 * Returns the body of the single plain `<script>` block of an `.astro` file and throws on anything else
 * (none, several, or one with attributes such as `is:inline` / `define:vars`), so a later change to the file
 * fails loudly instead of the tests silently reading the wrong block. Plain string search on purpose: these are
 * our own trusted sources, not arbitrary HTML.
 */
export function extractInlineScript(source: string, file: string): string {
  const open = '<script>';
  const close = '</script>';
  const start = source.indexOf(open);
  const end = start === -1 ? -1 : source.indexOf(close, start + open.length);
  if (start === -1 || end === -1) throw new Error(`No inline <script> found in ${file}`);

  const rest = source.slice(0, start) + source.slice(end + close.length);
  if (rest.includes('<script')) {
    throw new Error(`${file}: expected exactly one plain <script> block (no attributes) for ?astro-script`);
  }
  return source.slice(start + open.length, end);
}
