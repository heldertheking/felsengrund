import type { OfferFrontmatter } from './Offer';
import type { EpisodeFrontmatter } from './Podcast';

// The markdown `body` field isn't part of the frontmatter types (it's a sibling of `data` on
// Offer/Episode), but the admin create/update endpoints take it alongside the frontmatter form
// fields, so it's added as an extra optional property here, the same way `cardImage`/`audio` are.
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

export interface SaveResult {
  slug: string;
}

export interface LoginResult {
  token: string;
}
