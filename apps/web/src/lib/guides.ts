import data from './admin-guides.json';

export type GuideId = 'podcast' | 'offers';

export interface GuideStep {
  title: string;
  text: string;
  narration: string;
  required?: 'pflicht' | 'optional';
  /** Where this step starts in the video, in seconds. */
  start?: number;
}

export interface Guide {
  id: GuideId;
  title: string;
  summary: string;
  video: { src: string; poster: string; captions: string; duration?: number };
  steps: GuideStep[];
}

export const GUIDES: Record<GuideId, Guide> = {
  podcast: data.podcast as Guide,
  offers: data.offers as Guide,
};

export const GUIDE_ORDER: GuideId[] = ['offers', 'podcast'];

export function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
