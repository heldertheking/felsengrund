import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OfferDetail from '../../src/components/OfferDetail';
import PodcastDetail from '../../src/components/PodcastDetail';
import PodcastPlayer from '../../src/components/PodcastPlayer';
import { makeEpisodeDetail, makeOfferDetail } from '../fixtures';
import { jsonResponse, mockApi } from '../helpers';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

function visit(path: string) {
  window.history.pushState({}, '', path);
}

describe('OfferDetail', () => {
  it('fetches the offer for the slug in the URL and renders its details', async () => {
    visit('/angebote/kinderstunde');
    const { calls } = mockApi({
      'GET /offers/kinderstunde': () =>
        jsonResponse(
          makeOfferDetail({
            title: 'Kinderstunde',
            intro: 'Für die Kleinen',
            schedule: 'Sonntags 10:00',
            location: 'Kirche',
            mapsLink: 'https://maps.example/x',
            targetAudience: 'Kinder',
            registration: 'Keine',
            organizers: [{ name: 'Anna', role: 'Leitung', contact: 'a@b.ch' }, { name: 'Ben' }],
            googleMapsIframeLink: 'https://maps.example/embed',
            bodyHtml: '<p>Hallo <strong>Welt</strong></p>',
          }),
        ),
    });

    render(<OfferDetail />);
    expect(screen.getByText('Wird geladen …')).toBeInTheDocument();

    expect(await screen.findByRole('heading', { level: 1, name: 'Kinderstunde' })).toBeInTheDocument();
    expect(calls[0].url).toBe('http://api.test/offers/kinderstunde');
    expect(screen.getByText('Kinder & Jugend')).toBeInTheDocument();
    expect(screen.getByText('Für die Kleinen')).toBeInTheDocument();
    expect(screen.getByText('Sonntags 10:00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kirche' })).toHaveAttribute('href', 'https://maps.example/x');
    expect(screen.getByText('Hallo').parentElement).toContainHTML('<strong>Welt</strong>');
    expect(screen.getByText('Anna')).toBeInTheDocument();
    expect(screen.getByText(/Leitung/)).toBeInTheDocument();
    expect(screen.getByText(/a@b\.ch/)).toBeInTheDocument();
    expect(document.querySelector('iframe')).toHaveAttribute('src', 'https://maps.example/embed');
    expect(screen.getByRole('link', { name: 'Kontaktformular' })).toHaveAttribute(
      'href',
      `/kontakt?subject=${encodeURIComponent('Frage(n) bezüglich Kinderstunde')}`,
    );
  });

  it('omits sections whose data is missing', async () => {
    visit('/angebote/minimal');
    mockApi({ 'GET /offers/minimal': () => jsonResponse(makeOfferDetail({ slug: 'minimal', title: 'Minimal' })) });

    render(<OfferDetail />);

    await screen.findByRole('heading', { name: 'Minimal' });
    expect(screen.queryByText('Zeitplan')).not.toBeInTheDocument();
    expect(screen.queryByText('Ort')).not.toBeInTheDocument();
    expect(screen.queryByText('Ansprechpersonen')).not.toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('shows "not found" for a 404', async () => {
    visit('/angebote/weg');
    mockApi({ 'GET /offers/weg': () => jsonResponse({ message: 'nope' }, 404) });
    render(<OfferDetail />);
    expect(await screen.findByRole('heading', { name: 'Angebot nicht gefunden' })).toBeInTheDocument();
  });

  it('shows an alert for other failures', async () => {
    visit('/angebote/kaputt');
    mockApi({ 'GET /offers/kaputt': () => jsonResponse({ message: 'x' }, 500) });
    render(<OfferDetail />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Das Angebot konnte nicht geladen werden.');
  });
});

describe('PodcastDetail', () => {
  it('renders the episode with player, speakers and shownotes', async () => {
    visit('/podcast/folge-1');
    mockApi({
      'GET /podcast/folge-1': () =>
        jsonResponse(
          makeEpisodeDetail({
            title: 'Erste Folge',
            episodeNumber: 4,
            duration: '10:00',
            speakers: [{ name: 'Anna', main: true }],
            bodyHtml: '<p>Notizen</p>',
          }),
        ),
    });

    render(<PodcastDetail />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Erste Folge' })).toBeInTheDocument();
    expect(screen.getByText(/Podcast · Folge 4/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abspielen' })).toBeInTheDocument();
    expect(screen.getByText('Anna')).toBeInTheDocument();
    expect(screen.getByText('Notizen')).toBeInTheDocument();
    expect(document.querySelector('audio')).toHaveAttribute('src', 'http://api.test/media/a.mp3');
  });

  it('treats the index path "/podcast" as not found without calling the API', () => {
    visit('/podcast');
    const { fn } = mockApi({});
    render(<PodcastDetail />);
    expect(screen.getByRole('heading', { name: 'Episode nicht gefunden' })).toBeInTheDocument();
    expect(fn).not.toHaveBeenCalled();
  });

  it('shows not-found for a 404 and an alert for errors', async () => {
    visit('/podcast/weg');
    mockApi({ 'GET /podcast/weg': () => jsonResponse({ message: 'x' }, 404) });
    const { unmount } = render(<PodcastDetail />);
    expect(await screen.findByRole('heading', { name: 'Episode nicht gefunden' })).toBeInTheDocument();
    unmount();

    mockApi({ 'GET /podcast/weg': () => jsonResponse({ message: 'x' }, 500) });
    render(<PodcastDetail />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Episode konnte nicht geladen werden.');
  });
});

describe('PodcastPlayer', () => {
  function setup() {
    render(<PodcastPlayer src="http://x/a.mp3" title="Folge" />);
    const audio = document.querySelector('audio')!;
    // jsdom does not implement media playback.
    const play = vi.fn(function (this: HTMLAudioElement) {
      Object.defineProperty(this, 'paused', { value: false, configurable: true });
      this.dispatchEvent(new Event('play'));
      return Promise.resolve();
    });
    const pause = vi.fn(function (this: HTMLAudioElement) {
      Object.defineProperty(this, 'paused', { value: true, configurable: true });
      this.dispatchEvent(new Event('pause'));
    });
    Object.defineProperty(audio, 'paused', { value: true, configurable: true });
    audio.play = play;
    audio.pause = pause;
    return { audio, play, pause };
  }

  it('toggles between play and pause and updates the button label', () => {
    const { play, pause } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Abspielen' }));
    expect(play).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Pausieren' }));
    expect(pause).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Abspielen' })).toBeInTheDocument();
  });

  it('formats the elapsed and total time from the audio element', () => {
    const { audio } = setup();
    expect(screen.getAllByText('0:00')).toHaveLength(2);

    Object.defineProperty(audio, 'duration', { value: 125, configurable: true });
    act(() => void audio.dispatchEvent(new Event('loadedmetadata')));
    Object.defineProperty(audio, 'currentTime', { value: 65, configurable: true, writable: true });
    act(() => void audio.dispatchEvent(new Event('timeupdate')));

    expect(screen.getByText('2:05')).toBeInTheDocument();
    expect(screen.getByText('1:05')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Wiedergabeposition - Folge' })).toHaveAttribute('max', '125');
  });

  it('seeks the audio element when the slider is committed', () => {
    const { audio } = setup();
    Object.defineProperty(audio, 'duration', { value: 100, configurable: true });
    act(() => void audio.dispatchEvent(new Event('loadedmetadata')));
    const slider = screen.getByRole('slider');

    fireEvent.change(slider, { target: { value: '42' } });
    fireEvent.mouseUp(slider);

    expect(audio.currentTime).toBe(42);
  });

  it('shows the play button again when playback ends', () => {
    const { audio } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Abspielen' }));
    act(() => void audio.dispatchEvent(new Event('ended')));
    expect(screen.getByRole('button', { name: 'Abspielen' })).toBeInTheDocument();
  });
});
