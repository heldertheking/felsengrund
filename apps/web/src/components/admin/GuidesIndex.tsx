import { formatTime, GUIDES, GUIDE_ORDER, type GuideId } from '../../lib/guides';

export default function GuidesIndex({ onOpen }: { onOpen: (id: GuideId) => void }) {
  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-kf-ink">Anleitungen</h2>
      <p className="mt-1 text-sm text-kf-ink-muted">
        Kurze Videos mit Ton, dazu die Schritte zum Nachlesen. Fast alle Angaben in den Formularen sind optional: nur
        Pflichtfelder (mit * markiert) müssen ausgefüllt sein.
      </p>
      <ul className="mt-6 grid gap-5 sm:grid-cols-2">
        {GUIDE_ORDER.map((id) => {
          const guide = GUIDES[id];
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onOpen(id)}
                className="group block w-full overflow-hidden rounded-xl border border-kf-edge bg-kf-surface text-left transition hover:border-kf-accent hover:shadow-md"
              >
                <img
                  src={guide.video.poster}
                  alt=""
                  loading="lazy"
                  className="aspect-video w-full bg-kf-surface-sunken object-cover"
                />
                <span className="block p-4">
                  <span className="block font-display text-sm font-semibold text-kf-ink group-hover:text-kf-accent">
                    {guide.title}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-kf-ink-muted">{guide.summary}</span>
                  <span className="mt-2 block text-xs font-semibold text-kf-accent">
                    ▶ Video{guide.video.duration ? ` (${formatTime(guide.video.duration)} Min.)` : ''} und{' '}
                    {guide.steps.length} Schritte
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
