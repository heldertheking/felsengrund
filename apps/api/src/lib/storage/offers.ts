import { Offer, OfferFrontmatter } from '@felsengrund/types';
import {
  deleteMedia,
  formatMarkdocFile,
  listSlugs,
  OFFER_IMAGES_PREFIX,
  OFFERS_PREFIX,
  putImage,
  serializeMdocFile,
} from './shared';

export const OffersRepository = {
  list: async (storage: R2Bucket): Promise<Offer[]> => {
    const slugs = await listSlugs(storage, OFFERS_PREFIX);
    const offers = await Promise.all(slugs.map((slug) => OffersRepository.get(storage, slug)));
    return offers.filter((offer): offer is Offer => offer !== null);
  },
  get: async (storage: R2Bucket, slug: string): Promise<Offer | null> => {
    const object = await storage.get(`${OFFERS_PREFIX}${slug}.mdoc`);
    if (!object) return null;
    const { data, body } = formatMarkdocFile(await object.text());
    return { slug, data: data as unknown as OfferFrontmatter, body };
  },
  put: async (storage: R2Bucket, slug: string, data: OfferFrontmatter, body: string): Promise<void> => {
    await storage.put(
      `${OFFERS_PREFIX}${slug}.mdoc`,
      serializeMdocFile(data as unknown as Record<string, unknown>, body),
      { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } },
    );
  },
  putImage: (storage: R2Bucket, slug: string, file: File): Promise<string> => {
    return putImage(storage, OFFER_IMAGES_PREFIX, slug, file);
  },
  /** Deletes the offer document and its card image. */
  delete: async (storage: R2Bucket, slug: string): Promise<void> => {
    const offer = await OffersRepository.get(storage, slug);
    await storage.delete(`${OFFERS_PREFIX}${slug}.mdoc`);
    await deleteMedia(storage, [offer?.data.cardImage]);
  },
};
