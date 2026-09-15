import { renderMarkdoc } from '@felsengrund/api-core';
import type { Episode } from '@felsengrund/types';
import { env } from 'cloudflare:workers';
import { createLogger } from '@felsengrund/logger';

const logger = createLogger('xml-feed');

export interface EpisodeItem {
  title: string;
  description: string; // Raw HTML wrapped in a CDATA section
  link: string; // Recommended: Web link for this episode
  guid: string; // Required: Unique ID
  pubDate: string; // Required: RFC 2822 formatted date string
  audioUrl: string; // Required: Direct link to audio file
  audioByteLength: number; // Required: File size in bytes
  audioType: string; // Required: e.g., 'audio/mpeg'
  duration: string; // Recommended: HH:MM:SS or MM:SS format
  episodeType: 'full' | 'trailer' | 'bonus'; // Optional
  episodeNumber?: number; // Optional
  imageUrl?: string; // Optional: Episode-specific artwork
}

export interface PodcastFeedData {
  title: string; // Required
  link: string; // Required
  atomLink: string;
  description: string; // Required
  language: string; // Default: de-ch
  copyright: string; // HARDCODED: &#169; 2026 Kirche Felsengrund
  author?: string; // Recommended
  ownerName: string; // HARDCODED: Oliver Lutz
  ownerEmail: string; // HARDCODED:
  imageUrl: string; // Required: Cover art URL (min 1400x1400)
  category: string; // HARDCODED: Religion & Spirituality
  subcategory?: string; // HARDCODED: Christianity
  isExplicit: boolean; // HARDCODED: False
  episodes: EpisodeItem[]; // Sorted newest episode first
}

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => XML_ESCAPES[char]);
}

// RSS `pubDate` and iTunes feed dates use RFC 822/2822 format. `Date#toUTCString()` produces the
// same "Www, dd Mmm yyyy HH:MM:SS GMT" shape and is what every podcast client/validator expects.
function toRfc2822(date: Date): string {
  return date.toUTCString();
}

async function resolveAudioMeta(mediaPath: string): Promise<{ byteLength: number; type: string }> {
  // `mediaPath` is the relative `/media/<key>` path stored in frontmatter (see
  // packages/api-core/src/admin-content.ts) - strip the prefix to get the R2 object key.
  const key = mediaPath.replace(/^\/media\//, '');
  const head = await env.STORAGE.head(key);
  if (!head) {
    // Not fatal (the enclosure still gets a valid, if size-0, entry) but a byteLength of 0 makes
    // for a broken download in most podcast clients, so it's worth flagging loudly.
    logger.warn('audio object not found in R2 - enclosure will report length 0', { key });
  }
  return {
    byteLength: head?.size ?? 0,
    type: head?.httpMetadata?.contentType || 'audio/mpeg',
  };
}

export async function episodeToXmlItem(episode: Episode): Promise<EpisodeItem> {
  const link = [env.KFA_WEBPAGE_ORIGIN, 'podcast', episode.slug].join('/');
  const { byteLength, type } = await resolveAudioMeta(episode.data.audioUrl);

  const pubDate = new Date(episode.data.publishDate);
  if (Number.isNaN(pubDate.valueOf())) {
    throw new Error(
      `episode "${episode.slug}" has an invalid publishDate (${JSON.stringify(episode.data.publishDate)})`,
    );
  }

  return {
    title: episode.data.title,
    description: `<![CDATA[${renderMarkdoc(episode.body)}]]>`,
    link,
    guid: link, // Stable per episode (slug-derived), so it's safe to use as an RSS permalink GUID
    pubDate: toRfc2822(pubDate),
    audioUrl: `${env.KFA_WORKER_ORIGIN}${episode.data.audioUrl}`,
    audioByteLength: byteLength,
    audioType: type,
    duration: episode.data.duration ?? '',
    episodeType: 'full',
    episodeNumber: episode.data.episodeNumber,
    imageUrl: episode.data.coverImage ? `${env.KFA_WORKER_ORIGIN}${episode.data.coverImage}` : undefined,
  };
}

function renderItemXml(item: EpisodeItem): string {
  return `
    <item>
      <title>${escapeXml(item.title)}</title>
      <description>${item.description}</description>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="true">${escapeXml(item.guid)}</guid>
      <pubDate>${item.pubDate}</pubDate>
      <enclosure url="${escapeXml(item.audioUrl)}" length="${item.audioByteLength}" type="${escapeXml(item.audioType)}" />
      <itunes:duration>${escapeXml(item.duration)}</itunes:duration>
      <itunes:episodeType>${item.episodeType}</itunes:episodeType>
      ${item.episodeNumber !== undefined ? `<itunes:episode>${item.episodeNumber}</itunes:episode>` : ''}
      ${item.imageUrl ? `<itunes:image href="${escapeXml(item.imageUrl)}" />` : ''}
      <itunes:explicit>false</itunes:explicit>    
    </item>`;
}

// Assembles a full RSS 2.0 + iTunes-namespace podcast feed document, ready to serve as-is with a
// `application/rss+xml` content type.
export function buildPodcastFeedXml(feed: PodcastFeedData): string {
  const items = feed.episodes.map(renderItemXml).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(feed.title)}</title>
    <link>${escapeXml(feed.link)}</link>
    <atom:link href="${feed.atomLink}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(feed.description)}</description>
    <language>${escapeXml(feed.language)}</language>
    <copyright>${feed.copyright}</copyright>
    ${feed.author ? `<itunes:author>${escapeXml(feed.author)}</itunes:author>` : ''}
    <itunes:owner>
      <itunes:name>${escapeXml(feed.ownerName)}</itunes:name>
      <itunes:email>${escapeXml(feed.ownerEmail)}</itunes:email>
    </itunes:owner>
    <itunes:image href="${escapeXml(feed.imageUrl)}" />
    <itunes:category text="${escapeXml(feed.category)}">
      ${feed.subcategory ? `<itunes:category text="${escapeXml(feed.subcategory)}" />` : ''}
    </itunes:category>
    <itunes:explicit>${feed.isExplicit ? 'true' : 'false'}</itunes:explicit>
    ${items}
  </channel>
</rss>`;
}

export async function generateETag(xmlString: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(xmlString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // Get the first 16 characters for a short ETag string
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `"${hashHex.substring(0, 16)}"`;
}
