/**
 * Pure text-edit builders behind the admin Markdown editor: each one turns the current value and selection
 * into a single replacement, which the editor applies at the cursor. Kept free of React so the guide pages
 * can list the same actions and shortcuts.
 */

export type Edit = { from: number; to: number; text: string; selectFrom: number; selectTo: number };
export type Builder = (value: string, start: number, end: number) => Edit;

// Replaces value[from..to] with `text` and places the selection afterwards.
function replace(from: number, to: number, text: string, selStart: number, selEnd: number): Edit {
  return { from, to, text, selectFrom: from + selStart, selectTo: from + selEnd };
}

function inline(marker: string, placeholder: string): Builder {
  return (value, start, end) => {
    const before = value.slice(start - marker.length, start);
    const after = value.slice(end, end + marker.length);
    if (before === marker && after === marker) {
      const inner = value.slice(start, end);
      return replace(start - marker.length, end + marker.length, inner, 0, inner.length);
    }
    const inner = start === end ? placeholder : value.slice(start, end);
    return replace(start, end, `${marker}${inner}${marker}`, marker.length, marker.length + inner.length);
  };
}

function link(): Builder {
  return (value, start, end) => {
    const label = start === end ? 'Linktext' : value.slice(start, end);
    const url = 'https://';
    const text = `[${label}](${url})`;
    // Select the URL so it can be typed over straight away.
    return replace(start, end, text, label.length + 3, label.length + 3 + url.length);
  };
}

function linePrefix(prefix: (index: number) => string, placeholder: string): Builder {
  return (value, start, end) => {
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const nextBreak = value.indexOf('\n', end);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
    const source = value.slice(lineStart, lineEnd) || placeholder;
    const lines = source.split('\n');
    const existing = /^(#{1,6} |- |\d+\. |> )/;
    const allPrefixed = lines.every((line) => existing.test(line));
    const next = lines.map((line, i) => (allPrefixed ? line.replace(existing, '') : `${prefix(i)}${line}`)).join('\n');
    return replace(lineStart, lineEnd, next, 0, next.length);
  };
}

function block(text: string, selectFrom: number, selectTo: number): Builder {
  return (value, start, end) => {
    const needsLeadingBreak = start > 0 && !value.slice(0, start).endsWith('\n\n');
    const lead = needsLeadingBreak ? (value.slice(0, start).endsWith('\n') ? '\n' : '\n\n') : '';
    const trail = value.slice(end).startsWith('\n') ? '' : '\n\n';
    return replace(start, end, `${lead}${text}${trail}`, lead.length + selectFrom, lead.length + selectTo);
  };
}

export interface Action {
  id: string;
  label: string;
  example: string;
  shortcut?: string;
  build: Builder;
}

export const MARKDOWN_ACTIONS: Action[] = [
  { id: 'bold', label: 'Fett', example: '**Text**', shortcut: 'B', build: inline('**', 'fetter Text') },
  { id: 'italic', label: 'Kursiv', example: '*Text*', shortcut: 'I', build: inline('*', 'kursiver Text') },
  { id: 'code', label: 'Code', example: '`Text`', shortcut: 'E', build: inline('`', 'Code') },
  { id: 'link', label: 'Link', example: '[Text](https://…)', shortcut: 'K', build: link() },
  { id: 'h2', label: 'Überschrift', example: '## Titel', build: linePrefix(() => '## ', 'Überschrift') },
  { id: 'h3', label: 'Zwischentitel', example: '### Titel', build: linePrefix(() => '### ', 'Zwischentitel') },
  { id: 'ul', label: 'Aufzählung', example: '- Punkt', build: linePrefix(() => '- ', 'Punkt') },
  { id: 'ol', label: 'Nummerierte Liste', example: '1. Schritt', build: linePrefix((i) => `${i + 1}. `, 'Schritt') },
  { id: 'quote', label: 'Zitat', example: '> Zitat', build: linePrefix(() => '> ', 'Zitat') },
  { id: 'hr', label: 'Trennlinie', example: '---', build: block('---', 3, 3) },
  {
    id: 'table',
    label: 'Tabelle',
    example: '| A | B |',
    build: block('| Spalte 1 | Spalte 2 |\n| --- | --- |\n| Zelle | Zelle |', 2, 10),
  },
];

export const SHORTCUT_KEYS = new Map(
  MARKDOWN_ACTIONS.filter((a) => a.shortcut).map((a) => [a.shortcut!.toLowerCase(), a]),
);
