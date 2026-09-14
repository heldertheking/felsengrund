import { useRef, useState, type ChangeEvent, type SyntheticEvent } from 'react';

interface Props {
  src: string;
  title: string;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function PodcastPlayer({ src, title }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play();
    else audio.pause();
  }

  function handleSeekInput(event: ChangeEvent<HTMLInputElement>) {
    setSeeking(true);
    setCurrentTime(Number(event.target.value));
  }

  function commitSeek(event: SyntheticEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    const value = Number((event.target as HTMLInputElement).value);
    if (audio) audio.currentTime = value;
    setSeeking(false);
  }

  return (
    <div className="flex items-center gap-4">
      <audio
        ref={audioRef}
        preload="metadata"
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          if (!seeking) setCurrentTime(e.currentTarget.currentTime);
        }}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? 'Pausieren' : 'Abspielen'}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-kf-accent text-white transition hover:opacity-90"
      >
        {playing ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
            <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-5 w-5" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={handleSeekInput}
          onMouseUp={commitSeek}
          onTouchEnd={commitSeek}
          onKeyUp={commitSeek}
          aria-label={`Wiedergabeposition – ${title}`}
          className="w-full accent-kf-accent"
        />
        <div className="mt-1 flex justify-between text-xs tabular-nums text-kf-ink-muted">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
