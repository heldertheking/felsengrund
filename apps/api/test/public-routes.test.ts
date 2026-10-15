import { beforeEach, describe, expect, it } from 'vitest';
import { FeedUtils, OffersRepository, PodcastRepository } from '../src/lib';
import { call, clearBucket, testEnv } from './helpers';

const ORIGIN = 'https://felsengrund.jroliveirahelder.workers.dev';

beforeEach(clearBucket);

const putOffer = (slug: string, data: Parameters<typeof OffersRepository.put>[2], body = '') =>
  OffersRepository.put(testEnv.STORAGE, slug, data, body);
const putEpisode = (slug: string, data: Parameters<typeof PodcastRepository.put>[2], body = '') =>
  PodcastRepository.put(testEnv.STORAGE, slug, data, body);

describe('app', () => {
  it('GET / describes the API', async () => {
    const res = await call('/');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ name: 'Kirche Felsengrund API', environment: 'local' });
  });

  it('answers unknown paths with a JSON 404', async () => {
    const res = await call('/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ status: 'error', message: 'Not found.' });
  });
});

describe('GET /offers', () => {
  it('returns an empty list for an empty bucket', async () => {
    const res = await call('/offers');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('lists offers with media URLs rewritten to the worker origin', async () => {
    await putOffer('a', { title: 'A', category: 'sonstiges', cardImage: '/media/images/offers/a.png' }, 'body');
    await putOffer('b', { title: 'B', category: 'senioren', cardImage: 'https://elsewhere.test/x.png' });
    const offers = (await (await call('/offers')).json()) as { slug: string; data: { cardImage: string } }[];
    const bySlug = Object.fromEntries(offers.map((o) => [o.slug, o.data.cardImage]));
    expect(bySlug).toEqual({ a: `${ORIGIN}/media/images/offers/a.png`, b: 'https://elsewhere.test/x.png' });
  });
});

describe('GET /offers/:slug', () => {
  it('returns the offer with rendered HTML', async () => {
    await putOffer('gebet', { title: 'Gebet', category: 'gottesdienst' }, '# Titel\n\nText **fett**');
    const res = await call('/offers/gebet');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { slug: string; body: string; bodyHtml: string };
    expect(body.slug).toBe('gebet');
    expect(body.body).toBe('# Titel\n\nText **fett**');
    expect(body.bodyHtml).toContain('<h1>Titel</h1>');
    expect(body.bodyHtml).toContain('<strong>fett</strong>');
  });

  it('escapes raw HTML written in the body', async () => {
    await putOffer('x', { title: 'X', category: 'sonstiges' }, 'a <script>alert(1)</script> b');
    const body = (await (await call('/offers/x')).json()) as { bodyHtml: string };
    expect(body.bodyHtml).not.toContain('<script>');
  });

  it('answers 404 for an unknown slug', async () => {
    const res = await call('/offers/unknown');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ status: 'error', message: 'Offer not found', meta: { slug: 'unknown' } });
  });
});

describe('GET /nav', () => {
  it('groups offers by category in the configured order and adds the static help link', async () => {
    await putOffer('kids', { title: 'Kids', category: 'kinder-jugend' });
    await putOffer('sonntag', { title: 'Sonntag', category: 'gottesdienst' });
    await putOffer('hilfe', { title: 'Einkaufen', category: 'hilfe-service' });
    const groups = await (await call('/nav')).json();
    expect(groups).toEqual([
      { label: 'Gottesdienst', links: [{ label: 'Sonntag', href: '/angebote/sonntag' }] },
      { label: 'Kinder & Jugend', links: [{ label: 'Kids', href: '/angebote/kids' }] },
      {
        label: 'Hilfe & Service',
        links: [
          { label: 'Einkaufen', href: '/angebote/hilfe' },
          { label: 'Ich brauche Hilfe', href: '/ich-brauche-hilfe' },
        ],
      },
    ]);
  });

  it('only contains the static help group for an empty bucket', async () => {
    expect(await (await call('/nav')).json()).toEqual([
      { label: 'Hilfe & Service', links: [{ label: 'Ich brauche Hilfe', href: '/ich-brauche-hilfe' }] },
    ]);
  });
});

describe('GET /podcast', () => {
  it('lists episodes newest first with rewritten media URLs', async () => {
    await putEpisode('alt', { title: 'Alt', publishDate: '2025-01-01', audioUrl: '/media/podcast/alt.mp3' });
    await putEpisode('neu', {
      title: 'Neu',
      publishDate: '2026-06-01',
      audioUrl: '/media/podcast/neu.mp3',
      coverImage: '/media/images/podcast/neu.png',
    });
    const episodes = (await (await call('/podcast')).json()) as { slug: string; data: Record<string, string> }[];
    expect(episodes.map((e) => e.slug)).toEqual(['neu', 'alt']);
    expect(episodes[0].data.audioUrl).toBe(`${ORIGIN}/media/podcast/neu.mp3`);
    expect(episodes[0].data.coverImage).toBe(`${ORIGIN}/media/images/podcast/neu.png`);
  });

  it('GET /podcast/:slug returns the episode with HTML, or 404', async () => {
    await putEpisode('e', { title: 'E', publishDate: '2026-01-01', audioUrl: '/media/podcast/e.mp3' }, 'Hallo *Welt*');
    const res = await call('/podcast/e');
    const body = (await res.json()) as { bodyHtml: string; data: { audioUrl: string } };
    expect(body.bodyHtml).toContain('<em>Welt</em>');
    expect(body.data.audioUrl).toBe(`${ORIGIN}/media/podcast/e.mp3`);

    const missing = await call('/podcast/missing');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ message: 'Episode not found', meta: { slug: 'missing' } });
  });
});

describe('FeedUtils.decodeEntities', () => {
  it('decodes in a single pass, never twice', () => {
    expect(FeedUtils.decodeEntities('&amp;lt;')).toBe('&lt;');
    expect(FeedUtils.decodeEntities('&amp;#8217;')).toBe('&#8217;');
  });

  it('decodes named, decimal and hex entities', () => {
    expect(FeedUtils.decodeEntities('&lt;a&gt; &quot;x&quot; &#39;y&#39; &apos;z&apos; &amp;')).toBe(
      `<a> "x" 'y' 'z' &`,
    );
    expect(FeedUtils.decodeEntities('it&#8217;s &#x2019; &#X41;')).toBe('it’s ’ A');
    expect(FeedUtils.decodeEntities('a&nbsp;b')).toBe('a b');
  });

  it('leaves unknown entities and invalid code points untouched', () => {
    for (const text of ['&bogus;', '&#0;', '&#xD800;', '&#1114112;', '&#99999999999;', '& amp;', '&amp']) {
      expect(FeedUtils.decodeEntities(text)).toBe(text);
    }
  });
});

describe('GET /podcast/feed.xml', () => {
  it('is not shadowed by /podcast/:slug and has feed headers', async () => {
    const res = await call('/podcast/feed.xml');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/rss+xml; charset=utf-8');
    expect(res.headers.get('ETag')).toMatch(/^"[0-9a-f]{16}"$/);
    expect(res.headers.get('Last-Modified')).toBeNull();
    const xml = await res.text();
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<title>Kirche Felsengrund Podcast</title>');
  });

  it('renders episodes with enclosure size and type from R2, and escapes user text', async () => {
    await testEnv.STORAGE.put('podcast/e1.mp3', 'ABCDEFGHIJ', { httpMetadata: { contentType: 'audio/mpeg' } });
    await putEpisode(
      'e1',
      {
        title: 'Brot & <Wein>',
        publishDate: '2026-03-01',
        audioUrl: '/media/podcast/e1.mp3',
        duration: '10:00',
        episodeNumber: 3,
        coverImage: '/media/images/podcast/e1.png',
      },
      'Text mit <b>Tags</b> & Zeichen ]]> Ende',
    );
    const res = await call('/podcast/feed.xml');
    const xml = await res.text();
    expect(xml).toContain('<title>Brot &amp; &lt;Wein&gt;</title>');
    // The summary is plain text, escaped exactly once.
    expect(xml).toContain('<description>Text mit &lt;b&gt;Tags&lt;/b&gt; &amp; Zeichen ]]&gt; Ende</description>');
    expect(xml).toContain(`<enclosure url="${ORIGIN}/media/podcast/e1.mp3" length="10" type="audio/mpeg" />`);
    expect(xml).toContain('<itunes:episode>3</itunes:episode>');
    expect(xml).toContain('<itunes:duration>10:00</itunes:duration>');
    expect(xml).toContain(`<itunes:image href="${ORIGIN}/media/images/podcast/e1.png" />`);
    expect(xml).toContain('<guid isPermaLink="true">https://staging.kirche-felsengrund.ch/podcast/e1</guid>');
    expect(xml).toContain('<pubDate>Sun, 01 Mar 2026 00:00:00 GMT</pubDate>');
    // The rich-text HTML sits in a CDATA block that a literal `]]>` in the body must not terminate early.
    expect(xml).toContain('<content:encoded><![CDATA[<article><p>Text mit &lt;b&gt;Tags&lt;/b&gt;');
    expect(xml.match(/\]\]>/g)).toHaveLength(1);
    expect(res.headers.get('Last-Modified')).toBe('Sun, 01 Mar 2026 00:00:00 GMT');
  });

  it('skips an episode with an invalid publish date instead of failing the feed', async () => {
    await putEpisode('good', { title: 'Gut', publishDate: '2026-01-01', audioUrl: '/media/podcast/good.mp3' });
    await putEpisode('bad', { title: 'Schlecht', publishDate: 'not-a-date', audioUrl: '/media/podcast/bad.mp3' });
    const res = await call('/podcast/feed.xml');
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain('<title>Gut</title>');
    expect(xml).not.toContain('Schlecht');
  });

  it('reports size 0 when the audio object is missing', async () => {
    await putEpisode('x', { title: 'X', publishDate: '2026-01-01', audioUrl: '/media/podcast/x.mp3' });
    const xml = await (await call('/podcast/feed.xml')).text();
    expect(xml).toContain('length="0" type="audio/mpeg"');
  });
});
