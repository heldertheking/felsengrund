import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { MARKDOWN_ACTIONS, SHORTCUT_KEYS, type Action } from '../../lib/markdown-actions';

const textareaClass =
  'w-full rounded-lg border border-kf-edge bg-kf-surface px-3 py-2 font-mono text-sm text-kf-ink focus:border-kf-accent focus:outline-none focus:ring-1 focus:ring-kf-accent';

const STORAGE_KEY = 'kf-admin-markdown-help';

function readOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'open';
  } catch {
    return false;
  }
}

function writeOpen(open: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, open ? 'open' : 'closed');
  } catch {
    // Storage can be blocked (private window): the panel then simply starts closed.
  }
}

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}

export function MarkdownEditor({ label, value, onChange, rows = 14 }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(readOpen);
  const panelId = useId();

  function toggle() {
    setOpen((current) => {
      writeOpen(!current);
      return !current;
    });
  }

  function run(action: Action) {
    const el = textareaRef.current;
    if (!el) return;
    const edit = action.build(el.value, el.selectionStart, el.selectionEnd);
    el.focus();
    el.setSelectionRange(edit.from, edit.to);
    // execCommand keeps the browser's native undo stack (Ctrl+Z) intact; setRangeText is the fallback.
    const inserted = document.execCommand('insertText', false, edit.text);
    if (!inserted) {
      el.setRangeText(edit.text, edit.from, edit.to, 'end');
      onChange(el.value);
    }
    el.setSelectionRange(edit.selectFrom, edit.selectTo);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return;
    const action = SHORTCUT_KEYS.get(event.key.toLowerCase());
    if (!action) return;
    event.preventDefault();
    run(action);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-kf-ink-muted">{label}</label>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="rounded-lg border border-kf-edge px-3 py-1 text-xs font-semibold text-kf-ink transition hover:border-kf-accent hover:text-kf-accent"
        >
          {open ? 'Markdown-Hilfe schliessen' : 'Markdown-Hilfe'}
        </button>
      </div>

      <div className="mt-1 flex flex-col gap-3 lg:flex-row lg:items-start">
        <textarea
          ref={textareaRef}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`${textareaClass} min-w-0 lg:flex-1`}
        />
        {open && (
          <aside
            id={panelId}
            aria-label="Markdown-Hilfe"
            data-guide="markdown-help"
            className="w-full shrink-0 rounded-lg border border-kf-edge bg-kf-surface-sunken p-3 lg:w-64"
          >
            <p className="text-xs text-kf-ink-muted">
              Text markieren und auf ein Element klicken, oder ohne Markierung an der Cursorposition einfügen.
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-1.5 lg:grid-cols-1">
              {MARKDOWN_ACTIONS.map((action) => (
                <li key={action.id}>
                  <button
                    type="button"
                    // mousedown would blur the textarea and lose the selection before click runs.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => run(action)}
                    className="flex w-full items-center justify-between gap-2 rounded-md border border-kf-edge bg-kf-surface px-2.5 py-1.5 text-left text-xs transition hover:border-kf-accent hover:text-kf-accent"
                  >
                    <span className="font-semibold">{action.label}</span>
                    <code className="truncate text-[11px] text-kf-ink-muted">
                      {action.shortcut ? `Strg+${action.shortcut}` : action.example}
                    </code>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-kf-ink-muted">
              Tastenkürzel: <kbd>Strg</kbd>+<kbd>B</kbd> fett, <kbd>I</kbd> kursiv, <kbd>E</kbd> Code, <kbd>K</kbd> Link
              (Mac: <kbd>⌘</kbd>). Ein zweiter Klick auf dieselbe Formatierung entfernt sie wieder.
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}
