import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkdownEditor } from '../../../src/components/admin/MarkdownEditor';
import { MARKDOWN_ACTIONS } from '../../../src/lib/markdown-actions';

const STORAGE_KEY = 'kf-admin-markdown-help';

function Harness({ initial = '', onValue }: { initial?: string; onValue?: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <MarkdownEditor
      label="Inhalt (Markdoc)"
      value={value}
      onChange={(v) => {
        setValue(v);
        onValue?.(v);
      }}
    />
  );
}

function textarea() {
  return screen.getByLabelText('Inhalt (Markdoc)') as HTMLTextAreaElement;
}

function select(start: number, end = start) {
  const el = textarea();
  el.focus();
  el.setSelectionRange(start, end);
}

async function openHelp() {
  await userEvent.click(screen.getByRole('button', { name: 'Markdown-Hilfe' }));
}

/** jsdom has no `document.execCommand`; tests opt in to a fake and this removes it again. */
function setExecCommand(impl: ((...args: unknown[]) => boolean) | undefined) {
  Object.defineProperty(document, 'execCommand', { value: impl, configurable: true, writable: true });
}

afterEach(() => {
  Reflect.deleteProperty(document, 'execCommand');
});

describe('MarkdownEditor label and panel', () => {
  it('links the label to the textarea', async () => {
    render(<Harness initial="x" />);
    expect(textarea()).toHaveValue('x');
    await userEvent.click(screen.getByText('Inhalt (Markdoc)'));
    expect(textarea()).toHaveFocus();
  });

  it('starts closed and opens and closes the help sidebar with the toggle button', async () => {
    render(<Harness />);
    const toggle = screen.getByRole('button', { name: 'Markdown-Hilfe' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();

    await userEvent.click(toggle);
    const panel = screen.getByRole('complementary', { name: 'Markdown-Hilfe' });
    expect(panel).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls', panel.id);
    expect(toggle).toHaveTextContent('Markdown-Hilfe schließen');

    await userEvent.click(toggle);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('lists one button per markdown action in the sidebar', async () => {
    render(<Harness />);
    await openHelp();
    const panel = screen.getByRole('complementary');
    for (const action of MARKDOWN_ACTIONS) {
      expect(panel).toHaveTextContent(action.label);
    }
    expect(panel.querySelectorAll('button')).toHaveLength(MARKDOWN_ACTIONS.length);
  });

  it('remembers the open state in localStorage across mounts', async () => {
    const { unmount } = render(<Harness />);
    await openHelp();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('open');
    unmount();

    render(<Harness />);
    expect(screen.getByRole('complementary')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Markdown-Hilfe schließen' }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('closed');
  });

  it('starts closed for any stored value other than "open"', () => {
    localStorage.setItem(STORAGE_KEY, 'closed');
    render(<Harness />);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('keeps working when localStorage throws on read and write', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<Harness />);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();

    await openHelp();
    expect(screen.getByRole('complementary')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Markdown-Hilfe schließen' }));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });
});

describe('MarkdownEditor actions (execCommand unavailable, setRangeText fallback)', () => {
  // jsdom does not implement execCommand; an explicit stub returning false is what browsers do when
  // the command is refused, and exercises the fallback path.
  it('reports no execCommand in jsdom by default', () => {
    expect(document.execCommand).toBeUndefined();
  });

  it('wraps the selected text and keeps it selected', async () => {
    setExecCommand(() => false);
    const onValue = vi.fn();
    render(<Harness initial="hello world" onValue={onValue} />);
    await openHelp();

    select(0, 5);
    await userEvent.click(screen.getByRole('button', { name: /^Fett/ }));

    expect(textarea()).toHaveValue('**hello** world');
    expect(onValue).toHaveBeenLastCalledWith('**hello** world');
    expect([textarea().selectionStart, textarea().selectionEnd]).toEqual([2, 7]);
  });

  it('inserts a placeholder at the cursor when nothing is selected', async () => {
    setExecCommand(() => false);
    render(<Harness initial="ab" />);
    await openHelp();

    select(1);
    await userEvent.click(screen.getByRole('button', { name: /^Kursiv/ }));

    expect(textarea()).toHaveValue('a*kursiver Text*b');
    expect(textarea().value.slice(textarea().selectionStart, textarea().selectionEnd)).toBe('kursiver Text');
  });

  it('toggles formatting off with a second click', async () => {
    setExecCommand(() => false);
    render(<Harness initial="hello" />);
    await openHelp();

    select(0, 5);
    await userEvent.click(screen.getByRole('button', { name: /^Fett/ }));
    expect(textarea()).toHaveValue('**hello**');
    await userEvent.click(screen.getByRole('button', { name: /^Fett/ }));
    expect(textarea()).toHaveValue('hello');
  });

  it('prefixes the current line for list and heading actions', async () => {
    setExecCommand(() => false);
    render(<Harness initial={'eins\nzwei'} />);
    await openHelp();

    select(6);
    await userEvent.click(screen.getByRole('button', { name: /^Aufzählung/ }));
    expect(textarea()).toHaveValue('eins\n- zwei');
  });

  it('does not touch the value when the textarea lost nothing: mousedown on an action keeps the selection', async () => {
    setExecCommand(() => false);
    render(<Harness initial="abc" />);
    await openHelp();
    select(0, 3);
    const button = screen.getByRole('button', { name: /^Code/ });

    const notPrevented = fireEvent.mouseDown(button);

    expect(notPrevented).toBe(false); // preventDefault stops the textarea from blurring
    expect([textarea().selectionStart, textarea().selectionEnd]).toEqual([0, 3]);
  });
});

describe('MarkdownEditor actions (native execCommand path)', () => {
  it('hands the edit to execCommand("insertText") so the browser undo stack keeps it', async () => {
    const exec = vi.fn(() => true);
    setExecCommand(exec);
    const onValue = vi.fn();
    render(<Harness initial="hello world" onValue={onValue} />);
    await openHelp();

    select(0, 5);
    await userEvent.click(screen.getByRole('button', { name: /^Fett/ }));

    expect(exec).toHaveBeenCalledWith('insertText', false, '**hello**');
    // The browser fires the input event itself in that case; the component must not also set the value.
    expect(onValue).not.toHaveBeenCalled();
    expect(textarea()).toHaveValue('hello world');
    expect([textarea().selectionStart, textarea().selectionEnd]).toEqual([2, 7]);
  });

  it('selects the replaced range before calling execCommand', async () => {
    let rangeAtCall: [number, number] | null = null;
    setExecCommand(() => {
      rangeAtCall = [textarea().selectionStart, textarea().selectionEnd];
      return true;
    });
    render(<Harness initial="x y z" />);
    await openHelp();

    select(2, 3);
    await userEvent.click(screen.getByRole('button', { name: /^Code/ }));

    expect(rangeAtCall).toEqual([2, 3]);
  });
});

describe('MarkdownEditor keyboard shortcuts', () => {
  async function pressWith(modifier: 'Control' | 'Meta', key: string) {
    await userEvent.keyboard(`{${modifier}>}${key}{/${modifier}}`);
  }

  it.each([
    ['Control', 'b', '**hello** world', [2, 7]],
    ['Control', 'i', '*hello* world', [1, 6]],
    ['Control', 'e', '`hello` world', [1, 6]],
    ['Meta', 'b', '**hello** world', [2, 7]],
    ['Meta', 'k', '[hello](https://) world', [8, 16]],
  ] as const)('%s+%s formats the selection', async (modifier, key, expected, range) => {
    setExecCommand(() => false);
    render(<Harness initial="hello world" />);
    select(0, 5);

    await pressWith(modifier, key);

    expect(textarea()).toHaveValue(expected);
    expect([textarea().selectionStart, textarea().selectionEnd]).toEqual(range);
  });

  it('prevents the browser default for a handled shortcut only', () => {
    setExecCommand(() => false);
    render(<Harness initial="abc" />);
    select(0, 3);

    expect(fireEvent.keyDown(textarea(), { key: 'b', ctrlKey: true })).toBe(false);
    expect(fireEvent.keyDown(textarea(), { key: 'z', ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(textarea(), { key: 'b' })).toBe(true);
  });

  it('accepts upper-case keys (caps lock)', () => {
    setExecCommand(() => false);
    render(<Harness initial="abc" />);
    select(0, 3);

    fireEvent.keyDown(textarea(), { key: 'B', ctrlKey: true });

    expect(textarea()).toHaveValue('**abc**');
  });

  it('ignores the shortcut with Shift or Alt held and without a modifier', () => {
    setExecCommand(() => false);
    render(<Harness initial="abc" />);
    select(0, 3);

    fireEvent.keyDown(textarea(), { key: 'b', ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(textarea(), { key: 'b', ctrlKey: true, altKey: true });
    fireEvent.keyDown(textarea(), { key: 'b' });

    expect(textarea()).toHaveValue('abc');
  });
});
