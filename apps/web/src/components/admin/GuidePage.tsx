import { useRef, useState } from 'react';
import { formatTime, type Guide } from '../../lib/guides';
import { MARKDOWN_ACTIONS } from '../../lib/markdown-actions';

const TAG_CLASS = {
  pflicht: 'bg-kf-accent text-white',
  optional: 'border border-dashed border-kf-ink-muted/60 text-kf-ink-muted',
} as const;

function MarkdownCheatSheet() {
  return (
    <section className="mt-10" aria-labelledby="guide-markdown">
      <h3 id="guide-markdown" className="font-display text-base font-semibold text-kf-ink">
        Texte formatieren (Markdown)
      </h3>
      <p className="mt-1 text-sm text-kf-ink-muted">
        Neben jedem Textfeld für Inhalte öffnet der Knopf «Markdown-Hilfe» eine Seitenleiste. Ein Klick darauf fügt die
        Formatierung an der Cursorposition ein oder formatiert den markierten Text. Alternativ tippst du die Zeichen
        direkt:
      </p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-kf-edge">
        <table className="w-full text-left text-sm">
          <thead className="bg-kf-surface-sunken text-xs uppercase tracking-wide text-kf-ink-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">Wirkung</th>
              <th className="px-3 py-2 font-semibold">Eingabe</th>
              <th className="px-3 py-2 font-semibold">Tastenkürzel</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-kf-edge">
            {MARKDOWN_ACTIONS.map((action) => (
              <tr key={action.id}>
                <td className="px-3 py-2 font-medium text-kf-ink">{action.label}</td>
                <td className="px-3 py-2">
                  <code className="text-kf-ink-muted">{action.example}</code>
                </td>
                <td className="px-3 py-2 text-kf-ink-muted">{action.shortcut ? `Strg + ${action.shortcut}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-kf-ink-muted">
        Auf dem Mac verwendest du ⌘ statt Strg. Ein zweiter Klick auf dieselbe Formatierung entfernt sie wieder. Mit
        Strg+Z machst du jede Änderung rückgängig.
      </p>
    </section>
  );
}

export default function GuidePage({ guide }: { guide: Guide }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeStep, setActiveStep] = useState(-1);

  function handleTimeUpdate() {
    const time = videoRef.current?.currentTime ?? 0;
    let active = -1;
    guide.steps.forEach((step, index) => {
      if (step.start !== undefined && step.start <= time + 0.2) active = index;
    });
    setActiveStep(active);
  }

  function seekTo(start: number) {
    const video = videoRef.current;
    if (!video) return;
    video.scrollIntoView({ behavior: 'smooth', block: 'center' });
    video.currentTime = start;
    void video.play().catch(() => undefined);
  }

  return (
    <article>
      <h2 className="font-display text-lg font-semibold text-kf-ink">{guide.title}</h2>
      <p className="mt-1 text-sm text-kf-ink-muted">{guide.summary}</p>

      <div className="mt-5 overflow-hidden rounded-xl border border-kf-edge bg-black shadow-sm">
        <video
          ref={videoRef}
          controls
          playsInline
          preload="metadata"
          poster={guide.video.poster}
          onTimeUpdate={handleTimeUpdate}
          className="aspect-video w-full"
        >
          <source src={guide.video.src} type="video/mp4" />
          Dein Browser kann dieses Video nicht abspielen.
        </video>
      </div>
      <p className="mt-2 text-xs text-kf-ink-muted">
        {guide.video.duration ? `Dauer ${formatTime(guide.video.duration)} Min. · ` : ''}
        Ohne Sprache: Markierungen und Einblendungen erklären jeden Schritt. Ein Klick auf eine Zeitmarke unten springt
        zur Stelle im Video.
      </p>

      <h3 className="mt-8 font-display text-base font-semibold text-kf-ink">Schritt für Schritt</h3>
      <ol className="mt-3 flex flex-col gap-3">
        {guide.steps.map((step, index) => (
          <li
            key={step.title}
            className={`rounded-xl border p-4 transition ${
              index === activeStep ? 'border-kf-accent bg-kf-surface-sunken' : 'border-kf-edge bg-kf-surface'
            }`}
          >
            <div className="flex flex-wrap items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-kf-accent text-sm font-bold text-white">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-display text-sm font-semibold text-kf-ink">{step.title}</h4>
                  {step.required && (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TAG_CLASS[step.required]}`}>
                      {step.required === 'pflicht' ? 'Pflicht' : 'optional'}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-kf-ink-muted">{step.text}</p>
              </div>
              {step.start !== undefined && (
                <button
                  type="button"
                  onClick={() => seekTo(step.start!)}
                  aria-label={`Video ab Schritt ${index + 1} abspielen`}
                  className="shrink-0 rounded-lg border border-kf-edge px-2.5 py-1 text-xs font-semibold text-kf-ink transition hover:border-kf-accent hover:text-kf-accent"
                >
                  ▶ {formatTime(step.start)}
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>

      <MarkdownCheatSheet />
    </article>
  );
}
