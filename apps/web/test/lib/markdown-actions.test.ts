import { describe, expect, it } from 'vitest';
import { MARKDOWN_ACTIONS, SHORTCUT_KEYS, type Action, type Edit } from '../../src/lib/markdown-actions';

function action(id: string): Action {
  const found = MARKDOWN_ACTIONS.find((a) => a.id === id);
  if (!found) throw new Error(`Unknown action ${id}`);
  return found;
}

/** Applies an edit to a value the way the editor does, returning the new value and the selected text. */
function apply(value: string, edit: Edit) {
  const next = value.slice(0, edit.from) + edit.text + value.slice(edit.to);
  return { next, selected: next.slice(edit.selectFrom, edit.selectTo) };
}

function run(id: string, value: string, start: number, end = start) {
  const edit = action(id).build(value, start, end);
  return { edit, ...apply(value, edit) };
}

describe('MARKDOWN_ACTIONS', () => {
  it('lists every action once with a label and an example', () => {
    const ids = MARKDOWN_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['bold', 'italic', 'code', 'link', 'h2', 'h3', 'ul', 'ol', 'quote', 'hr', 'table']);
    for (const a of MARKDOWN_ACTIONS) {
      expect(a.label).not.toBe('');
      expect(a.example).not.toBe('');
    }
  });

  it('maps the shortcut letters B, I, E and K (lowercase) to their actions', () => {
    expect([...SHORTCUT_KEYS.keys()].sort()).toEqual(['b', 'e', 'i', 'k']);
    expect(SHORTCUT_KEYS.get('b')?.id).toBe('bold');
    expect(SHORTCUT_KEYS.get('i')?.id).toBe('italic');
    expect(SHORTCUT_KEYS.get('e')?.id).toBe('code');
    expect(SHORTCUT_KEYS.get('k')?.id).toBe('link');
  });
});

describe.each([
  ['bold', '**', 'fetter Text'],
  ['italic', '*', 'kursiver Text'],
  ['code', '`', 'Code'],
])('inline action %s', (id, marker, placeholder) => {
  it('wraps the selection and keeps the text selected', () => {
    const { next, selected, edit } = run(id, 'hello world', 0, 5);
    expect(next).toBe(`${marker}hello${marker} world`);
    expect(selected).toBe('hello');
    expect(edit).toMatchObject({ from: 0, to: 5 });
  });

  it('inserts a selected placeholder at a bare cursor', () => {
    const { next, selected } = run(id, 'ab', 1);
    expect(next).toBe(`a${marker}${placeholder}${marker}b`);
    expect(selected).toBe(placeholder);
  });

  it('removes the markers again when the selection is already wrapped (toggle)', () => {
    const wrapped = `${marker}hello${marker}`;
    const start = marker.length;
    const { next, selected } = run(id, wrapped, start, start + 5);
    expect(next).toBe('hello');
    expect(selected).toBe('hello');
  });

  it('toggles back to the original text when applied twice', () => {
    const first = run(id, 'text', 0, 4);
    const second = run(id, first.next, first.edit.selectFrom, first.edit.selectTo);
    expect(second.next).toBe('text');
  });

  it('only unwraps when the markers sit on both sides', () => {
    const { next } = run(id, `${marker}hello`, marker.length, marker.length + 5);
    expect(next).toBe(`${marker}${marker}hello${marker}`);
  });
});

describe('link action', () => {
  it('turns the selection into a link label and selects the URL placeholder', () => {
    const { next, selected } = run('link', 'see docs now', 4, 8);
    expect(next).toBe('see [docs](https://) now');
    expect(selected).toBe('https://');
  });

  it('inserts a placeholder label at a bare cursor', () => {
    const { next, selected } = run('link', '', 0);
    expect(next).toBe('[Linktext](https://)');
    expect(selected).toBe('https://');
  });
});

describe.each([
  ['h2', '## '],
  ['h3', '### '],
  ['ul', '- '],
  ['quote', '> '],
])('line prefix action %s', (id, prefix) => {
  it('prefixes the line the cursor is on', () => {
    const { next, selected } = run(id, 'one\ntwo\nthree', 5);
    expect(next).toBe(`one\n${prefix}two\nthree`);
    expect(selected).toBe(`${prefix}two`);
  });

  it('prefixes every line touched by the selection', () => {
    const { next } = run(id, 'a\nb\nc', 0, 3);
    expect(next).toBe(`${prefix}a\n${prefix}b\nc`);
  });

  it('removes the prefix when every line already has it (toggle)', () => {
    const { next } = run(id, `${prefix}a\n${prefix}b`, 0, 6);
    expect(next).toBe('a\nb');
  });

  it('adds the prefix to all lines when only some have it', () => {
    const { next } = run(id, `${prefix}a\nb`, 0, 6);
    expect(next).toBe(`${prefix}${prefix}a\n${prefix}b`);
  });

  it('inserts a prefixed placeholder on an empty line', () => {
    const { next } = run(id, '', 0);
    expect(next.startsWith(prefix)).toBe(true);
    expect(next.length).toBeGreaterThan(prefix.length);
  });
});

describe('ordered list action', () => {
  it('numbers the selected lines from 1', () => {
    const { next } = run('ol', 'a\nb\nc', 0, 5);
    expect(next).toBe('1. a\n2. b\n3. c');
  });

  it('removes numbers again when every line is numbered', () => {
    const { next } = run('ol', '1. a\n2. b', 0, 9);
    expect(next).toBe('a\nb');
  });

  it('inserts a numbered placeholder on an empty document', () => {
    expect(run('ol', '', 0).next).toBe('1. Schritt');
  });
});

describe('line prefix switching', () => {
  it('strips another prefix instead of converting it (a second kind of list toggles the first off)', () => {
    expect(run('ol', '- a', 0, 3).next).toBe('a');
    expect(run('h2', '### Titel', 0).next).toBe('Titel');
  });
});

describe('block actions', () => {
  it('inserts a rule into an empty document with a trailing blank line', () => {
    const { next, edit } = run('hr', '', 0);
    expect(next).toBe('---\n\n');
    expect(edit).toMatchObject({ selectFrom: 3, selectTo: 3 });
  });

  it('separates the block from preceding text with a blank line', () => {
    expect(run('hr', 'abc', 3).next).toBe('abc\n\n---\n\n');
  });

  it('adds only one extra newline after a single line break and none after a blank line', () => {
    expect(run('hr', 'abc\n', 4).next).toBe('abc\n\n---\n\n');
    expect(run('hr', 'abc\n\n', 5).next).toBe('abc\n\n---\n\n');
  });

  it('does not add a trailing blank line when text already continues on the next line', () => {
    expect(run('hr', 'ab\ncd', 2).next).toBe('ab\n\n---\ncd');
  });

  it('replaces a selection with the block', () => {
    expect(run('hr', 'xx', 0, 2).next).toBe('---\n\n');
  });

  it('inserts a three-line table and selects the first header name', () => {
    const { next, selected } = run('table', '', 0);
    expect(next).toBe('| Spalte 1 | Spalte 2 |\n| --- | --- |\n| Zelle | Zelle |\n\n');
    expect(selected).toBe('Spalte 1');
  });

  it('keeps the selection inside the table when a lead break is added', () => {
    const { selected } = run('table', 'intro', 5);
    expect(selected).toBe('Spalte 1');
  });
});
