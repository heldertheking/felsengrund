import { beforeEach, describe, expect, it } from 'vitest';
import { OffersRepository, StorageUtils } from '../src/lib';
import { authHeaders, bytes, call, clearBucket, formBody, listKeys, readText, testEnv } from './helpers';

beforeEach(clearBucket);

async function postOffer(fields: Record<string, string | Blob | undefined>) {
  return call('/admin/offers', { method: 'POST', headers: await authHeaders(), body: formBody(fields) });
}

async function postImport(content: string, name = 'offer.mdoc') {
  return call('/admin/offers/import', {
    method: 'POST',
    headers: await authHeaders(),
    body: formBody({ file: new File([content], name, { type: 'text/markdown' }) }),
  });
}

describe('POST /admin/offers (create)', () => {
  it('stores the offer as frontmatter plus body, with a slug derived from the title', async () => {
    const res = await postOffer({
      title: 'Kinder Treff Süd',
      category: 'kinder-jugend',
      intro: 'Spiel und Spass',
      location: 'Gemeindehaus',
      organizers: JSON.stringify([{ name: 'Eva', role: 'Leitung' }]),
      body: '## Hallo\n\nWillkommen',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ slug: 'kinder-treff-sued' });

    const stored = await readText('offers/kinder-treff-sued.mdoc');
    expect(stored).toBe(
      [
        '---',
        'title: Kinder Treff Süd',
        'category: kinder-jugend',
        'intro: Spiel und Spass',
        'location: Gemeindehaus',
        'organizers:',
        '  - name: Eva',
        '    role: Leitung',
        '---',
        '',
        '## Hallo',
        '',
        'Willkommen',
        '',
      ].join('\n'),
    );
    expect((await testEnv.STORAGE.head('offers/kinder-treff-sued.mdoc'))?.httpMetadata?.contentType).toBe(
      'text/markdown; charset=utf-8',
    );
  });

  it('omits empty optional fields from the frontmatter', async () => {
    await postOffer({ title: 'Minimal', category: 'sonstiges', intro: '', schedule: '' });
    const stored = await readText('offers/minimal.mdoc');
    expect(stored).toBe('---\ntitle: Minimal\ncategory: sonstiges\n---\n\n\n');
  });

  it('trims the title', async () => {
    const res = await postOffer({ title: '  Gebet  ', category: 'gottesdienst' });
    expect(await res.json()).toEqual({ slug: 'gebet' });
    expect((await OffersRepository.get(testEnv.STORAGE, 'gebet'))?.data.title).toBe('Gebet');
  });

  it('ignores malformed or non-array organizers', async () => {
    await postOffer({ title: 'A', category: 'sonstiges', organizers: '{oops' });
    await postOffer({ title: 'B', category: 'sonstiges', organizers: '{"name":"x"}' });
    expect((await OffersRepository.get(testEnv.STORAGE, 'a'))?.data.organizers).toBeUndefined();
    expect((await OffersRepository.get(testEnv.STORAGE, 'b'))?.data.organizers).toBeUndefined();
  });

  it('answers 409 for a duplicate title and leaves the original untouched', async () => {
    await postOffer({ title: 'Doppelt', category: 'sonstiges', body: 'erste' });
    const res = await postOffer({ title: 'doppelt!', category: 'senioren', body: 'zweite' });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      status: 'error',
      message: 'Ein Angebot mit diesem Titel existiert bereits.',
    });
    expect((await OffersRepository.get(testEnv.STORAGE, 'doppelt'))?.body).toBe('erste');
  });

  it('answers 400 with the German message for a missing title or bad category', async () => {
    const noTitle = await postOffer({ category: 'sonstiges' });
    expect(noTitle.status).toBe(400);
    expect(await noTitle.json()).toMatchObject({ message: 'Titel fehlt.' });

    const blankTitle = await postOffer({ title: '   ', category: 'sonstiges' });
    expect(blankTitle.status).toBe(400);

    const badCategory = await postOffer({ title: 'X', category: 'nope' });
    expect(badCategory.status).toBe(400);
    expect(await badCategory.json()).toMatchObject({ message: 'Ungültige Kategorie.' });
    expect(await listKeys()).toEqual([]);
  });

  it('answers 400 when the title yields no slug', async () => {
    const res = await postOffer({ title: '!!!', category: 'sonstiges' });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ message: 'Titel ergibt keinen gültigen Slug.' });
  });

  it('stores the card image and records its media URL', async () => {
    const res = await postOffer({
      title: 'Mit Bild',
      category: 'sonstiges',
      cardImage: bytes('PNGDATA', 'Foto.PNG', 'image/png'),
    });
    expect(res.status).toBe(200);

    const offer = await OffersRepository.get(testEnv.STORAGE, 'mit-bild');
    expect(offer?.data.cardImage).toBe('/media/images/offers/mit-bild.png');
    const image = await testEnv.STORAGE.get('images/offers/mit-bild.png');
    expect(await image?.text()).toBe('PNGDATA');
    expect(image?.httpMetadata?.contentType).toBe('image/png');
  });

  it('ignores empty uploads', async () => {
    await postOffer({ title: 'Leer', category: 'sonstiges', cardImage: bytes('', 'a.png', 'image/png') });
    expect((await OffersRepository.get(testEnv.STORAGE, 'leer'))?.data.cardImage).toBeUndefined();
    expect(await listKeys('images/')).toEqual([]);
  });
});

describe('POST /admin/offers (edit)', () => {
  beforeEach(async () => {
    await postOffer({
      title: 'Alt',
      category: 'sonstiges',
      intro: 'alt',
      body: 'alter Text',
      cardImage: bytes('OLD', 'a.png', 'image/png'),
    });
  });

  it('overwrites the document under the given slug without a 409', async () => {
    const res = await postOffer({ slug: 'alt', title: 'Neu', category: 'senioren', body: 'neuer Text' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ slug: 'alt' });

    const offer = await OffersRepository.get(testEnv.STORAGE, 'alt');
    expect(offer?.data).toMatchObject({ title: 'Neu', category: 'senioren' });
    expect(offer?.data.intro).toBeUndefined(); // fields not sent are cleared
    expect(offer?.body).toBe('neuer Text');
  });

  it('keeps the existing card image when no new one is uploaded', async () => {
    await postOffer({ slug: 'alt', title: 'Alt', category: 'sonstiges' });
    expect((await OffersRepository.get(testEnv.STORAGE, 'alt'))?.data.cardImage).toBe('/media/images/offers/alt.png');
    expect(await listKeys('images/')).toEqual(['images/offers/alt.png']);
  });

  it('replaces the card image and deletes the old file when the extension changes', async () => {
    await postOffer({
      slug: 'alt',
      title: 'Alt',
      category: 'sonstiges',
      cardImage: bytes('NEW', 'b.webp', 'image/webp'),
    });
    expect((await OffersRepository.get(testEnv.STORAGE, 'alt'))?.data.cardImage).toBe('/media/images/offers/alt.webp');
    expect(await listKeys('images/')).toEqual(['images/offers/alt.webp']);
  });

  it('overwrites the image in place when the extension is unchanged', async () => {
    await postOffer({
      slug: 'alt',
      title: 'Alt',
      category: 'sonstiges',
      cardImage: bytes('NEW', 'b.png', 'image/png'),
    });
    expect(await readText('images/offers/alt.png')).toBe('NEW');
  });

  it('creates the offer when the slug does not exist yet', async () => {
    const res = await postOffer({ slug: 'frisch', title: 'Frisch', category: 'sonstiges' });
    expect(await res.json()).toEqual({ slug: 'frisch' });
    expect(await OffersRepository.get(testEnv.STORAGE, 'frisch')).not.toBeNull();
  });
});

describe('POST /admin/offers/import', () => {
  const doc = (frontmatter: string, body = 'Text') => `---\n${frontmatter}\n---\n\n${body}\n`;

  it('imports a mdoc file under a slug from its title', async () => {
    const res = await postImport(doc('title: Mein Angebot\ncategory: gemeinschaft\nintro: Hi', '# Hallo'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ slug: 'mein-angebot' });
    const offer = await OffersRepository.get(testEnv.STORAGE, 'mein-angebot');
    expect(offer).toEqual({
      slug: 'mein-angebot',
      data: { title: 'Mein Angebot', category: 'gemeinschaft', intro: 'Hi' },
      body: '# Hallo',
    });
  });

  it('handles CRLF line endings', async () => {
    const res = await postImport('---\r\ntitle: Windows\r\ncategory: senioren\r\n---\r\n\r\nKörper\r\n');
    expect(res.status).toBe(200);
    expect((await OffersRepository.get(testEnv.STORAGE, 'windows'))?.body).toBe('Körper');
  });

  it('answers 400 for a missing file', async () => {
    const res = await call('/admin/offers/import', {
      method: 'POST',
      headers: await authHeaders(),
      body: formBody({}),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ message: 'Datei fehlt.' });
  });

  it.each([
    ['no frontmatter', 'nur Text', 'Titel fehlt in der Datei.'],
    ['a blank title', doc('title: "  "\ncategory: senioren'), 'Titel fehlt in der Datei.'],
    ['a non-string title', doc('title: 12\ncategory: senioren'), 'Titel fehlt in der Datei.'],
    ['a missing category', doc('title: X'), 'Ungültige oder fehlende Kategorie in der Datei.'],
    ['an invalid category', doc('title: X\ncategory: nope'), 'Ungültige oder fehlende Kategorie in der Datei.'],
    ['a title without a slug', doc('title: "???"\ncategory: senioren'), 'Titel ergibt keinen gültigen Slug.'],
  ])('answers 400 for %s', async (_label, content, message) => {
    const res = await postImport(content);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ message });
    expect(await listKeys()).toEqual([]);
  });

  it('answers 409 when an offer with that slug exists', async () => {
    await postOffer({ title: 'Vorhanden', category: 'sonstiges', body: 'original' });
    const res = await postImport(doc('title: Vorhanden\ncategory: senioren', 'import'));
    expect(res.status).toBe(409);
    expect((await OffersRepository.get(testEnv.STORAGE, 'vorhanden'))?.body).toBe('original');
  });
});

describe('DELETE /admin/offers/:slug', () => {
  it('removes the document and its card image', async () => {
    await postOffer({ title: 'Weg', category: 'sonstiges', cardImage: bytes('X', 'a.jpg', 'image/jpeg') });
    expect(await listKeys()).toEqual(['images/offers/weg.jpg', 'offers/weg.mdoc']);

    const res = await call('/admin/offers/weg', { method: 'DELETE', headers: await authHeaders() });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(await listKeys()).toEqual([]);
  });

  it('is ok for an unknown slug and leaves other offers alone', async () => {
    await postOffer({ title: 'Bleibt', category: 'sonstiges' });
    const res = await call('/admin/offers/unbekannt', { method: 'DELETE', headers: await authHeaders() });
    expect(res.status).toBe(200);
    expect(await listKeys()).toEqual(['offers/bleibt.mdoc']);
  });

  it('only deletes media URLs, never arbitrary keys from the frontmatter', async () => {
    await testEnv.STORAGE.put(
      'offers/x.mdoc',
      '---\ntitle: X\ncategory: sonstiges\ncardImage: offers/other.mdoc\n---\n',
    );
    await testEnv.STORAGE.put('offers/other.mdoc', 'keep');
    await call('/admin/offers/x', { method: 'DELETE', headers: await authHeaders() });
    expect(await listKeys()).toEqual(['offers/other.mdoc']);
  });
});

describe('StorageUtils via the repository', () => {
  it('round-trips through the stored document', async () => {
    await OffersRepository.put(testEnv.STORAGE, 'rt', { title: 'RT', category: 'sonstiges' }, 'body');
    expect(StorageUtils.formatMarkdocFile((await readText('offers/rt.mdoc')) ?? '')).toEqual({
      data: { title: 'RT', category: 'sonstiges' },
      body: 'body',
    });
  });
});
