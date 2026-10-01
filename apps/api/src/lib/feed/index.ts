import { env } from 'cloudflare:workers';
import { createLogger } from '@felsengrund/logger';
import { Episode } from '@felsengrund/types';
import { StorageUtils } from '../storage';

export interface EpisodeItem {
  title: string;
  description: string; // Already XML-escaped
  contentEncoded: string; // Identical to description; Raw HTML inside CDATA block
  link: string; // Recommended: Web link for this episode
  guid: string;
  pubDate: string; // RFC 2822 formatted date string
  audioUrl: string;
  audioByteLength: number; // File size in Bytes
  audioType: string;
  duration: string; // Format HH:MM:SS or MM:SS
  episodeType?: 'full' | 'trailer' | 'bonus'; // Optional
  episodeNumber?: number; // Optional
  imageUrl?: string; // Optional: Episode-specific artwork
}

export interface PodcastFeedData {
  title: string;
  link: string; // Link to webpage
  atomLink: string; // Link to feed
  description: string;
  language: string; // Default: de-ch
  copyright: string;
  author?: string; // Author of the Feed, Recommended to have by multiple platforms
  ownerName: string;
  ownerEmail: string;
  imageUrl: string; // Cover art, required to have
  category: string;
  subcategory?: string;
  isExplicit: boolean;
  episodes: EpisodeItem[];
}

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

// === Setup ===
const logger = createLogger('XML Feed');

// === Helper Functions ===

const escapeXml = (value: string) => {
  return value.replace(/[&<>"']/g, (char) => XML_ESCAPES[char]);
};

const toRfc2822 = (date: Date) => {
  return date.toUTCString();
};

const parseAudioMetadata = async (path: string): Promise<{ size: number; type: string }> => {
  const key = path.replace(/^\/media\//, '');
  const head = await env.STORAGE.head(key);

  if (!head) {
    // Size 0 might result in broken downloads for podcast client.
    logger.warn('Unable to find audio object, enclosure will report size 0', { key });
  }

  return {
    size: head?.size ?? 0,
    type: head?.httpMetadata?.contentType ?? 'audio/mpeg',
  };
};

/** Rendered HTML -> plain text, unescaped; callers must run it through `escapeXml` before embedding. */
const stripToPlainText = async (html: string): Promise<string> => {
  let text = '';

  const rewriter = new HTMLRewriter().on('*', {
    text(chunk) {
      text += chunk.text;
    },
  });

  const res = new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });

  // Transform and drain the response stream
  const transformed = rewriter.transform(res);
  await transformed.text();

  return text.trim();
};

/** A literal `]]>` would terminate the CDATA section early. */
const toCdata = (value: string): string => `<![CDATA[${value.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`;

const generateETag = async (xmlString: string): Promise<string> => {
  const msgUint8 = new TextEncoder().encode(xmlString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `"${hashHex.substring(0, 16)}"`;
};

// === Business Logic ===

async function episodeToXmlItem(episode: Episode): Promise<EpisodeItem> {
  const link = [env.KFA_WEBPAGE_ORIGIN, 'podcast', episode.slug].join('/');
  const audioMeta = await parseAudioMetadata(episode.data.audioUrl);

  const pubDate = new Date(episode.data.publishDate);
  if (Number.isNaN(pubDate.valueOf())) {
    throw new Error(
      `episode "${episode.slug}" has an invalid publishDate (${JSON.stringify(episode.data.publishDate)})`,
    );
  }

  const htmlContent = StorageUtils.renderMarkdoc(episode.body);
  const plainTextDescription = await stripToPlainText(htmlContent);

  return {
    title: episode.data.title,
    // Pure plain text summary for compatibility
    description: escapeXml(plainTextDescription),
    // Securely wrapped HTML markup for rich text players
    contentEncoded: toCdata(htmlContent),
    link,
    guid: link,
    pubDate: toRfc2822(pubDate),
    audioUrl: `${env.KFA_WORKER_ORIGIN}${episode.data.audioUrl}`,
    audioByteLength: audioMeta.size,
    audioType: audioMeta.type,
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
      <content:encoded>${item.contentEncoded}</content:encoded>
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

function buildPodcastFeedXml(feed: PodcastFeedData): string {
  const items = feed.episodes.map(renderItemXml).join('');

  // The XML declaration must be the very first bytes of the document.
  return `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
    <channel>
      <title>${escapeXml(feed.title)}</title>
      <link>${escapeXml(feed.link)}</link>
      <atom:link href="${escapeXml(feed.atomLink)}" rel="self" type="application/rss+xml" />
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

export { generateETag, episodeToXmlItem, buildPodcastFeedXml };
