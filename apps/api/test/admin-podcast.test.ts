import { beforeEach, describe, expect, it } from 'vitest';
import { PodcastRepository } from '../src/lib';
import { authHeaders, bytes, call, clearBucket, formBody, listKeys, readText, testEnv } from './helpers';

beforeEach(clearBucket);

const audio = (name = 'predigt.mp3', type = 'audio/mpeg') => bytes('AUDIO', name, type);

async function postEpisode(fields: Record<string, string | Blob | undefined>) {
  return call('/admin/podcast', { method: 'POST', headers: await authHeaders(), body: formBody(fields) });
}

describe('POST /admin/podcast (create)', () => {
  it('stores the episode and its audio', async () => {
    const res = await postEpisode({
      title: 'Predigt über Gnade',
      publishDate: '2026-03-01',
      episodeNumber: '7',
      duration: '32:10',
      speakers: JSON.stringify([{ name: 'Oli', main: true }]),
      audio: audio(),
      body: 'Notizen',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ slug: 'predigt-ueber-gnade' });

    expect(await readText('podcast/predigt-ueber-gnade.mdoc')).toBe(
      [
        '---',
        'title: Predigt über Gnade',
        'publishDate: 2026-03-01',
        'audioUrl: /media/podcast/predigt-ueber-gnade.mp3',
        'episodeNumber: 7',
        'duration: 32:10',
        'speakers:',
        '  - name: Oli',
        '    main: true',
        '---',
        '',
        'Notizen',
        '',
      ].join('\n'),
    );
    const object = await testEnv.STORAGE.get('podcast/predigt-ueber-gnade.mp3');
    expect(await object?.text()).toBe('AUDIO');
    expect(object?.httpMetadata?.contentType).toBe('audio/mpeg');
  });

  it('keeps episodeNumber out of the frontmatter unless it is numeric', async () => {
    await postEpisode({ title: 'A', publishDate: '2026-01-01', episodeNumber: 'abc', audio: audio() });
    expect((await PodcastRepository.get(testEnv.STORAGE, 'a'))?.data.episodeNumber).toBeUndefined();
  });

  it('answers 400 without an audio file and stores nothing', async () => {
    const res = await postEpisode({ title: 'Stumm', publishDate: '2026-01-01' });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ message: 'Audiodatei fehlt.' });
    expect(await listKeys()).toEqual([]);
  });

  it('answers 400 for an empty audio upload', async () => {
    const res = await postEpisode({
      title: 'Leer',
      publishDate: '2026-01-01',
      audio: bytes('', 'a.mp3', 'audio/mpeg'),
    });
    expect(res.status).toBe(400);
  });

  it('validates the required fields', async () => {
    const noTitle = await postEpisode({ publishDate: '2026-01-01', audio: audio() });
    expect(noTitle.status).toBe(400);
    expect(await noTitle.json()).toMatchObject({ message: 'Titel fehlt.' });

    const noDate = await postEpisode({ title: 'X', audio: audio() });
    expect(noDate.status).toBe(400);
    expect(await noDate.json()).toMatchObject({ message: 'Veröffentlichungsdatum fehlt.' });

    const noSlug = await postEpisode({ title: '***', publishDate: '2026-01-01', audio: audio() });
    expect(noSlug.status).toBe(400);
    expect(await noSlug.json()).toMatchObject({ message: 'Titel ergibt keinen gültigen Slug.' });
    expect(await listKeys()).toEqual([]);
  });

  it('answers 409 for a duplicate title without touching the stored files', async () => {
    await postEpisode({ title: 'Folge', publishDate: '2026-01-01', audio: audio(), body: 'erste' });
    const res = await postEpisode({
      title: 'Folge',
      publishDate: '2026-02-01',
      audio: bytes('OTHER', 'x.mp3', 'audio/mpeg'),
      body: 'zweite',
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ message: 'Eine Episode mit diesem Titel existiert bereits.' });
    expect(await readText('podcast/folge.mp3')).toBe('AUDIO');
    expect((await PodcastRepository.get(testEnv.STORAGE, 'folge'))?.body).toBe('erste');
  });

  it('stores the cover image and sanitises odd extensions', async () => {
    await postEpisode({
      title: 'Cover',
      publishDate: '2026-01-01',
      audio: audio('Ton.M4A?x=1', 'audio/mp4'),
      coverImage: bytes('IMG', 'cover.JPEG', 'image/jpeg'),
    });
    const episode = await PodcastRepository.get(testEnv.STORAGE, 'cover');
    expect(episode?.data.audioUrl).toBe('/media/podcast/cover.m4ax1');
    expect(episode?.data.coverImage).toBe('/media/images/podcast/cover.jpeg');
    expect(await listKeys()).toEqual(['images/podcast/cover.jpeg', 'podcast/cover.m4ax1', 'podcast/cover.mdoc']);
  });
});

describe('POST /admin/podcast (edit)', () => {
  beforeEach(async () => {
    await postEpisode({
      title: 'Alt',
      publishDate: '2026-01-01',
      audio: audio(),
      coverImage: bytes('OLDIMG', 'c.png', 'image/png'),
      body: 'alt',
    });
  });

  it('keeps audio and cover when nothing new is uploaded', async () => {
    const res = await postEpisode({ slug: 'alt', title: 'Alt neu', publishDate: '2026-01-02', body: 'neu' });
    expect(res.status).toBe(200);
    const episode = await PodcastRepository.get(testEnv.STORAGE, 'alt');
    expect(episode?.data).toMatchObject({
      title: 'Alt neu',
      publishDate: '2026-01-02',
      audioUrl: '/media/podcast/alt.mp3',
      coverImage: '/media/images/podcast/alt.png',
    });
    expect(episode?.body).toBe('neu');
    expect(await listKeys()).toEqual(['images/podcast/alt.png', 'podcast/alt.mdoc', 'podcast/alt.mp3']);
  });

  it('replaces the audio and removes the old file when the extension changes', async () => {
    await postEpisode({ slug: 'alt', title: 'Alt', publishDate: '2026-01-01', audio: audio('n.wav', 'audio/wav') });
    expect((await PodcastRepository.get(testEnv.STORAGE, 'alt'))?.data.audioUrl).toBe('/media/podcast/alt.wav');
    expect(await listKeys('podcast/')).toEqual(['podcast/alt.mdoc', 'podcast/alt.wav']);
  });

  it('replaces the cover and removes the old one when the extension changes', async () => {
    await postEpisode({
      slug: 'alt',
      title: 'Alt',
      publishDate: '2026-01-01',
      coverImage: bytes('N', 'c.webp', 'image/webp'),
    });
    expect((await PodcastRepository.get(testEnv.STORAGE, 'alt'))?.data.coverImage).toBe(
      '/media/images/podcast/alt.webp',
    );
    expect(await listKeys('images/')).toEqual(['images/podcast/alt.webp']);
  });

  it('answers 400 when editing a slug that has no audio yet', async () => {
    const res = await postEpisode({ slug: 'neu', title: 'Neu', publishDate: '2026-01-01' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /admin/podcast/:slug', () => {
  it('removes the document, audio and cover', async () => {
    await postEpisode({
      title: 'Weg',
      publishDate: '2026-01-01',
      audio: audio(),
      coverImage: bytes('I', 'c.png', 'image/png'),
    });
    await postEpisode({ title: 'Bleibt', publishDate: '2026-01-01', audio: audio() });

    const res = await call('/admin/podcast/weg', { method: 'DELETE', headers: await authHeaders() });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(await listKeys()).toEqual(['podcast/bleibt.mdoc', 'podcast/bleibt.mp3']);
  });

  it('is ok for an unknown slug', async () => {
    const res = await call('/admin/podcast/gibtsnicht', { method: 'DELETE', headers: await authHeaders() });
    expect(res.status).toBe(200);
  });
});
