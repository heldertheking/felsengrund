import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { filterMdocFiles, toMdoc } from '../../src/lib/mdoc';

describe('toMdoc', () => {
  it('wraps the YAML frontmatter in --- fences followed by the trimmed body', () => {
    expect(toMdoc({ title: 'Hallo' }, '\n  Text hier  \n\n')).toBe('---\ntitle: Hallo\n---\n\nText hier\n');
  });

  it('round-trips through a YAML parser', () => {
    const data = { title: 'Gottesdienst: "Neu"', organizers: [{ name: 'Anna', role: 'Leitung' }], count: 3 };
    const [, yaml] = toMdoc(data, 'x').split('---\n');
    expect(parse(yaml)).toEqual(data);
  });

  it('does not fold long lines', () => {
    const title = 'wort '.repeat(60).trim();
    expect(toMdoc({ title }, '')).toContain(`title: ${title}\n`);
  });

  it('ends with a blank body line for an empty body', () => {
    expect(toMdoc({ a: 1 }, '   ')).toBe('---\na: 1\n---\n\n\n');
  });
});

describe('filterMdocFiles', () => {
  const file = (name: string) => new File(['x'], name);

  it('keeps only .mdoc files, case-insensitively', () => {
    const kept = filterMdocFiles([file('a.mdoc'), file('b.MDOC'), file('c.md'), file('d.mdoc.txt'), file('e')]);
    expect(kept.map((f) => f.name)).toEqual(['a.mdoc', 'b.MDOC']);
  });

  it('returns an empty list for no files', () => {
    expect(filterMdocFiles([])).toEqual([]);
  });
});
