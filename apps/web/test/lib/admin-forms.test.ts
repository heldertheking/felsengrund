import { describe, expect, it } from 'vitest';
import { offerForm, podcastForm } from '../../src/lib/admin-forms';

describe('offerForm', () => {
  it('defaults every optional text field to an empty string', () => {
    expect(offerForm({ title: 'Titel', category: 'gottesdienst', body: '' })).toEqual({
      title: 'Titel',
      intro: '',
      category: 'gottesdienst',
      targetAudience: '',
      schedule: '',
      location: '',
      mapsLink: '',
      googleMapsIframeLink: '',
      registration: '',
      organizers: '[]',
      body: '',
    });
  });

  it('only includes slug and cardImage when given', () => {
    const image = new File(['x'], 'card.jpg');
    const without = offerForm({ title: 'T', category: 'senioren', body: '' });
    expect(without).not.toHaveProperty('slug');
    expect(without).not.toHaveProperty('cardImage');

    const withBoth = offerForm({ title: 'T', category: 'senioren', body: '', cardImage: image }, 'mein-slug');
    expect(withBoth.slug).toBe('mein-slug');
    expect(withBoth.cardImage).toBe(image);
  });

  it('serialises organizers as JSON and drops the ones without a name', () => {
    const form = offerForm({
      title: 'T',
      category: 'gemeinschaft',
      body: 'b',
      organizers: [{ name: 'Anna', role: 'Leitung' }, { name: '   ' }, { name: '' }, { name: 'Ben' }],
    });
    expect(JSON.parse(form.organizers)).toEqual([{ name: 'Anna', role: 'Leitung' }, { name: 'Ben' }]);
  });
});

describe('podcastForm', () => {
  it('stringifies the episode number and omits it when absent or zero', () => {
    expect(podcastForm({ title: 'E', publishDate: '2026-01-01', episodeNumber: 7 }).episodeNumber).toBe('7');
    expect(podcastForm({ title: 'E', publishDate: '2026-01-01' })).not.toHaveProperty('episodeNumber');
    expect(podcastForm({ title: 'E', publishDate: '2026-01-01', episodeNumber: 0 })).not.toHaveProperty(
      'episodeNumber',
    );
  });

  it('includes slug, audio and coverImage only when given', () => {
    const audio = new File(['a'], 'a.mp3');
    const cover = new File(['c'], 'c.jpg');
    const form = podcastForm({ title: 'E', publishDate: '2026-01-01', audio, coverImage: cover }, 'folge-1');
    expect(form).toMatchObject({ slug: 'folge-1', audio, coverImage: cover });

    const bare = podcastForm({ title: 'E', publishDate: '2026-01-01' });
    expect(bare).toEqual({ title: 'E', publishDate: '2026-01-01', duration: '', speakers: '[]', body: '' });
  });

  it('filters speakers without a name and keeps the main flag', () => {
    const form = podcastForm({
      title: 'E',
      publishDate: '2026-01-01',
      speakers: [{ name: 'Anna', main: true }, { name: ' ' }, { name: 'Ben' }],
    });
    expect(JSON.parse(form.speakers)).toEqual([{ name: 'Anna', main: true }, { name: 'Ben' }]);
  });
});
