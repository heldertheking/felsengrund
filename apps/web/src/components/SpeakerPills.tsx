import type { PodcastSpeaker } from '@felsengrund/types';

interface Props {
  speakers: PodcastSpeaker[];
}

export default function SpeakerPills({ speakers }: Props) {
  if (speakers.length === 0) return null;

  // A single speaker is always treated as the featured one, even without `main` set.
  const isFeatured = (speaker: PodcastSpeaker) => speakers.length === 1 || Boolean(speaker.main);

  const ordered = [...speakers].sort((a, b) => Number(isFeatured(b)) - Number(isFeatured(a)));

  return (
    <div className="mt-6 flex flex-wrap gap-2">
      {ordered.map((speaker, index) => (
        <span
          key={index}
          className={`rounded-full border border-kf-edge bg-kf-surface-sunken px-3.5 py-1 text-sm ${
            isFeatured(speaker) ? 'font-bold text-kf-accent' : 'font-medium text-kf-ink'
          }`}
        >
          {speaker.name}
        </span>
      ))}
    </div>
  );
}
