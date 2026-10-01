import { Episode, EpisodeFrontmatter } from '@felsengrund/types';
import {
  deleteMedia,
  formatMarkdocFile,
  listSlugs,
  MEDIA_URL_PREFIX,
  PODCAST_IMAGES_PREFIX,
  PODCAST_PREFIX,
  putImage,
  serializeMdocFile,
} from './shared';

export const PodcastRepository = {
  list: async (storage: R2Bucket, sorted: boolean = false): Promise<Episode[]> => {
    const slugs = await listSlugs(storage, PODCAST_PREFIX);
    const episodes = await Promise.all(slugs.map((slug) => PodcastRepository.get(storage, slug)));
    const result = episodes.filter((episode): episode is Episode => episode !== null);

    if (sorted) {
      return result.sort((a, b) => new Date(b.data.publishDate).getTime() - new Date(a.data.publishDate).getTime());
    }

    return result;
  },
  get: async (storage: R2Bucket, slug: string): Promise<Episode | null> => {
    const object = await storage.get(`${PODCAST_PREFIX}${slug}.mdoc`);
    if (!object) return null;
    const { data, body } = formatMarkdocFile(await object.text());
    return { slug, data: data as unknown as EpisodeFrontmatter, body };
  },
  put: async (storage: R2Bucket, slug: string, data: EpisodeFrontmatter, body: string): Promise<void> => {
    await storage.put(
      `${PODCAST_PREFIX}${slug}.mdoc`,
      serializeMdocFile(data as unknown as Record<string, unknown>, body),
      { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } },
    );
  },
  putImage: (storage: R2Bucket, slug: string, file: File): Promise<string> => {
    return putImage(storage, PODCAST_IMAGES_PREFIX, slug, file);
  },
  putAudio: async (storage: R2Bucket, slug: string, file: File): Promise<string> => {
    const ext =
      file.name
        .split('.')
        .pop()
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, '') || 'mp3';
    const key = `${PODCAST_PREFIX}${slug}.${ext}`;
    await storage.put(key, file, {
      httpMetadata: { contentType: file.type || 'audio/mpeg' },
    });
    return `${MEDIA_URL_PREFIX}${key}`;
  },
  /** Deletes the episode document plus its audio and cover image. */
  delete: async (storage: R2Bucket, slug: string): Promise<void> => {
    const episode = await PodcastRepository.get(storage, slug);
    await storage.delete(`${PODCAST_PREFIX}${slug}.mdoc`);
    await deleteMedia(storage, [episode?.data.audioUrl, episode?.data.coverImage]);
  },
};
