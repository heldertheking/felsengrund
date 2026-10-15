import { beforeEach, describe, expect, it } from 'vitest';
import { OffersRepository, PodcastRepository, StorageUtils } from '../src/lib';
import { formatMarkdocFile, listSlugs, serializeMdocFile } from '../src/lib/storage/shared';
import { clearBucket, listKeys, testEnv } from './helpers';

describe('slugify', () => {
  it.each([
    ['Hello World', 'hello-world'],
    ['  Trim  me  ', 'trim-me'],
    ['Grüezi Müller & Söhne', 'grueezi-mueller-soehne'],
    ['Straße', 'strasse'],
    ['Café Crème', 'cafe-creme'],
    ['A / B -- C', 'a-b-c'],
    ['2026: Jahr', '2026-jahr'],
    ['---', ''],
    ['日本語', ''],
    ['', ''],
  ])('%j -> %j', (input, expected) => {
    expect(StorageUtils.slugify(input)).toBe(expected);
  });

  it('never produces path separators or dots', () => {
    expect(StorageUtils.slugify('../../etc/passwd')).toBe('etc-passwd');
  });
});

describe('formatMarkdocFile / serializeMdocFile', () => {
  it('parses frontmatter and trims the body', () => {
    expect(formatMarkdocFile('---\ntitle: A\nn: 3\n---\n\n  Body  \n')).toEqual({
      data: { title: 'A', n: 3 },
      body: 'Body',
    });
  });

  it('treats a file without frontmatter as body only', () => {
    expect(formatMarkdocFile('  just text \n')).toEqual({ data: {}, body: 'just text' });
  });

  it('handles empty frontmatter, an empty body and CRLF', () => {
    expect(formatMarkdocFile('---\n\n---\nBody')).toEqual({ data: {}, body: 'Body' });
    expect(formatMarkdocFile('---\ntitle: A\n---')).toEqual({ data: { title: 'A' }, body: '' });
    expect(formatMarkdocFile('---\r\ntitle: A\r\n---\r\nB\r\nC')).toEqual({ data: { title: 'A' }, body: 'B\r\nC' });
  });

  it('keeps a body that itself contains a --- rule', () => {
    expect(formatMarkdocFile('---\ntitle: A\n---\n\nx\n\n---\n\ny')).toEqual({
      data: { title: 'A' },
      body: 'x\n\n---\n\ny',
    });
  });

  it('serializes with a trailing newline and without line wrapping', () => {
    const long = 'word '.repeat(60).trim();
    const out = serializeMdocFile({ title: long }, '\n body \n');
    expect(out).toBe(`---\ntitle: ${long}\n---\n\nbody\n`);
  });

  it('round-trips awkward values', () => {
    const data = { title: 'Colon: in title', tags: ['a', 'b'], nested: { x: 1 }, quote: `it's "q"`, flag: true };
    expect(formatMarkdocFile(serializeMdocFile(data, 'text'))).toEqual({ data, body: 'text' });
  });
});

describe('renderMarkdoc', () => {
  it('renders markdown to HTML', () => {
    const html = StorageUtils.renderMarkdoc('# Hi\n\n- a\n- b');
    expect(html).toContain('<h1>Hi</h1>');
    expect(html).toContain('<li>a</li>');
  });
});

describe('deleteMedia', () => {
  beforeEach(clearBucket);

  it('deletes only /media/ keys and ignores everything else', async () => {
    await testEnv.STORAGE.put('a.png', '1');
    await testEnv.STORAGE.put('b.png', '2');
    await StorageUtils.deleteMedia(testEnv.STORAGE, ['/media/a.png', undefined, 'b.png', 'https://x.test/b.png']);
    expect(await listKeys()).toEqual(['b.png']);
  });

  it('does nothing for an empty list', async () => {
    await expect(StorageUtils.deleteMedia(testEnv.STORAGE, [undefined])).resolves.toBeUndefined();
  });
});

describe('repositories', () => {
  beforeEach(clearBucket);

  it('listSlugs only returns .mdoc documents under the prefix', async () => {
    await testEnv.STORAGE.put('offers/a.mdoc', '');
    await testEnv.STORAGE.put('offers/b.png', '');
    await testEnv.STORAGE.put('podcast/c.mdoc', '');
    expect(await listSlugs(testEnv.STORAGE, 'offers/')).toEqual(['a']);
  });

  it('list skips nothing and get returns null for a missing document', async () => {
    await OffersRepository.put(testEnv.STORAGE, 'one', { title: '1', category: 'sonstiges' }, '');
    await OffersRepository.put(testEnv.STORAGE, 'two', { title: '2', category: 'sonstiges' }, '');
    expect((await OffersRepository.list(testEnv.STORAGE)).map((o) => o.slug).sort()).toEqual(['one', 'two']);
    expect(await OffersRepository.get(testEnv.STORAGE, 'three')).toBeNull();
  });

  it('podcast list can be sorted newest first', async () => {
    const base = { audioUrl: '/media/podcast/x.mp3' };
    await PodcastRepository.put(testEnv.STORAGE, 'old', { ...base, title: 'Old', publishDate: '2024-05-01' }, '');
    await PodcastRepository.put(testEnv.STORAGE, 'new', { ...base, title: 'New', publishDate: '2026-05-01' }, '');
    await PodcastRepository.put(testEnv.STORAGE, 'mid', { ...base, title: 'Mid', publishDate: '2025-05-01' }, '');
    expect((await PodcastRepository.list(testEnv.STORAGE, true)).map((e) => e.slug)).toEqual(['new', 'mid', 'old']);
  });
});
