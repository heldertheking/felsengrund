interface PodcastSpeaker {
  name: string;
  main?: boolean; // Featured speaker, shown first. A lone speaker is always treated as main.
}

/** Metadata stored in the mdoc file's frontmatter. */
interface Frontmatter {
  title: string; // Displayed as h1 on the page
  episodeNumber?: number; // Prefilled with file count + 1
  publishDate: string;
  audioUrl: string;
  duration?: string; // free text, e.g. "32:10" — never parsed/computed, just displayed
  coverImage?: string;
  speakers?: PodcastSpeaker[];
}

interface Episode {
  slug: string; // Derived from the title; requires recreation to modify
  data: Frontmatter;
  body: string; // Markdown text, no images
}

interface EpisodeDetailResponse extends Episode {
  bodyHtml: string;
}

export type { EpisodeDetailResponse, Episode, Frontmatter as EpisodeFrontmatter, PodcastSpeaker };
