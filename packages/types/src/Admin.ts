import type { OfferFrontmatter } from './Offer';
import type { EpisodeFrontmatter } from './Podcast';

export type CreateOfferInput = Omit<OfferFrontmatter, 'cardImage'> & {
  cardImage?: File;
  body?: string;
};
export type UpdateOfferInput = CreateOfferInput;

export type CreatePodcastInput = Omit<EpisodeFrontmatter, 'audioUrl' | 'coverImage'> & {
  audio: File;
  coverImage?: File;
  body?: string;
};
export type UpdatePodcastInput = Omit<CreatePodcastInput, 'audio'> & {
  audio?: File;
};
