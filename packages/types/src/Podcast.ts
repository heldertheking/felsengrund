/**
 * <p>Represents metadata stored in the mdoc files frontmatter</p>
 *
 * @property title Title displayed as <code>h1</code> on page.
 * @property episodeNumber The episode number we are currently on.
 * @property publishDate The date the episode was published.
 * @property audioUrl Link to the audio file.
 * @property duration Duration of the audio file.
 * @property coverImage Image used on the page.
 */
interface Frontmatter {
    title: string;
    episodeNumber?: number; // TODO: Can we prefill this?
    publishDate: string;
    audioUrl: string;
    duration?: string; // free text, e.g. "32:10" — never parsed/computed, just displayed
    coverImage?: string;
}

/**
 * @property slug Slugified version of original Title - requires recreation to modify.
 * @property data {@link Frontmatter} parsed from mdoc file.
 * @property body Markdown text, no images
 */
interface Episode {
    slug: string; // Composed of the original title
    data: Frontmatter;
    body: string;
}

interface EpisodeDetailResponse extends Episode {
    bodyHtml: string;
}

export type { EpisodeDetailResponse, Episode, Frontmatter as EpisodeFrontmatter};