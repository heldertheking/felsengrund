import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import Markdoc from '@markdoc/markdoc';

// === Declarations ===
export const OFFERS_PREFIX = 'offers/';
export const PODCAST_PREFIX = 'podcast/';
export const OFFER_IMAGES_PREFIX = 'images/offers/';
export const PODCAST_IMAGES_PREFIX = 'images/podcast/';
export const MEDIA_URL_PREFIX = '/media/';

const formatMarkdocFile = (raw: string): { data: Record<string, unknown>; body: string } => {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw.trim() };
  return {
    data: (parseYaml(match[1]) ?? {}) as Record<string, unknown>,
    body: match[2].trim(),
  };
};

const serializeMdocFile = (data: Record<string, unknown>, body: string): string => {
  const yaml = stringifyYaml(data, { lineWidth: 0 }).trim();
  return `---\n${yaml}\n---\n\n${body.trim()}\n`;
};

const listSlugs = async (storage: R2Bucket, prefix: string): Promise<string[]> => {
  const result = await storage.list({ prefix });
  return result.objects
    .filter((object) => object.key.endsWith('.mdoc'))
    .map((object) => object.key.slice(prefix.length, -'.mdoc'.length));
};

const putImage = async (storage: R2Bucket, prefix: string, slug: string, file: File): Promise<string> => {
  const ext =
    file.name
      .split('.')
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, '') || 'jpg';
  const key = `${prefix}${slug}.${ext}`;
  await storage.put(key, file, {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  });
  return `${MEDIA_URL_PREFIX}${key}`;
};

const renderMarkdoc = (source: string): string => {
  const ast = Markdoc.parse(source);
  const content = Markdoc.transform(ast);
  return Markdoc.renderers.html(content);
};

const UMLAUTS: Record<string, string> = { ß: 'ss', ä: 'ae', ö: 'oe', ü: 'ue' };

const slugify = (input: string): string => {
  return input
    .toLowerCase()
    .replace(/[äöüß]/g, (char) => UMLAUTS[char] ?? char)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/** Deletes the R2 objects behind `/media/<key>` URLs; ignores anything that isn't a media URL. */
const deleteMedia = async (storage: R2Bucket, urls: (string | undefined)[]): Promise<void> => {
  const keys = urls
    .filter((url): url is string => typeof url === 'string' && url.startsWith(MEDIA_URL_PREFIX))
    .map((url) => url.slice(MEDIA_URL_PREFIX.length));
  if (keys.length > 0) await storage.delete(keys);
};

export { formatMarkdocFile, serializeMdocFile, listSlugs, putImage, deleteMedia, renderMarkdoc, slugify };
