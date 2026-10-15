import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Breadcrumbs from '../../src/components/Breadcrumbs';
import OffersGrid from '../../src/components/OffersGrid';
import PodcastList from '../../src/components/PodcastList';
import SpeakerPills from '../../src/components/SpeakerPills';
import { makeEpisode, makeOffer } from '../fixtures';
import { jsonResponse, mockApi } from '../helpers';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('OffersGrid', () => {
  it('shows a loading message, then offers grouped under their category headings in category order', async () => {
    mockApi({
      'GET /offers': () =>
        jsonResponse([
          makeOffer({ slug: 'senioren-treff', title: 'Seniorentreff', category: 'senioren', intro: 'Kaffee' }),
          makeOffer({ slug: 'gottesdienst', title: 'Sonntag', category: 'gottesdienst' }),
        ]),
    });

    render(<OffersGrid />);
    expect(screen.getByText('Angebote werden geladen …')).toBeInTheDocument();

    expect(await screen.findByRole('link', { name: /Sonntag/ })).toHaveAttribute('href', '/angebote/gottesdienst');
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Gottesdienst', 'Senioren', 'Hilfe & Service']);
    expect(screen.getByText('Kaffee')).toBeInTheDocument();
  });

  it('skips empty categories except for the Hilfe & Service card linking to the help page', async () => {
    mockApi({ 'GET /offers': () => jsonResponse([]) });

    render(<OffersGrid />);

    expect(await screen.findByRole('heading', { name: 'Hilfe & Service' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ich brauche Hilfe/ })).toHaveAttribute('href', '/ich-brauche-hilfe');
    expect(screen.queryByRole('heading', { name: 'Gottesdienst' })).not.toBeInTheDocument();
  });

  it('renders the card image with the title as alt text when present', async () => {
    mockApi({ 'GET /offers': () => jsonResponse([makeOffer({ title: 'Mit Bild', cardImage: '/media/x.jpg' })]) });
    render(<OffersGrid />);
    expect(await screen.findByRole('img', { name: 'Mit Bild' })).toHaveAttribute('src', '/media/x.jpg');
  });

  it('shows an alert when the API fails', async () => {
    mockApi({ 'GET /offers': () => jsonResponse({ message: 'kaputt' }, 500) });
    render(<OffersGrid />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Angebote konnten nicht geladen werden.');
  });
});

describe('PodcastList', () => {
  it('lists episodes with a link, formatted date, duration and speakers', async () => {
    mockApi({
      'GET /podcast': () =>
        jsonResponse([
          makeEpisode({
            slug: 'folge-2',
            title: 'Zweite Folge',
            publishDate: '2026-03-15',
            duration: '32:10',
            speakers: [{ name: 'Anna' }, { name: 'Ben' }],
          }),
        ]),
    });

    render(<PodcastList />);
    expect(screen.getByText('Episoden werden geladen …')).toBeInTheDocument();

    const link = await screen.findByRole('link', { name: /Zweite Folge/ });
    expect(link).toHaveAttribute('href', '/podcast/folge-2');
    expect(link).toHaveTextContent(new Date('2026-03-15').toLocaleDateString('de-CH'));
    expect(link).toHaveTextContent('32:10 - Anna, Ben');
  });

  it('abbreviates three or more speakers', async () => {
    mockApi({
      'GET /podcast': () =>
        jsonResponse([
          makeEpisode({ slug: 'a', speakers: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] }),
          makeEpisode({ slug: 'b', speakers: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }] }),
        ]),
    });
    render(<PodcastList />);
    await screen.findAllByRole('link');
    expect(screen.getByText(/A, B, and 1 other$/)).toBeInTheDocument();
    expect(screen.getByText(/A, B, and 2 others$/)).toBeInTheDocument();
  });

  it('shows an empty state and an error state', async () => {
    mockApi({ 'GET /podcast': () => jsonResponse([]) });
    const { unmount } = render(<PodcastList />);
    expect(await screen.findByText('Noch keine Episoden veröffentlicht.')).toBeInTheDocument();
    unmount();

    mockApi({ 'GET /podcast': () => jsonResponse({ message: 'x' }, 500) });
    render(<PodcastList />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Episoden konnten nicht geladen werden.');
  });

  // Regression: PodcastList used `speakers!`, so an episode without speakers (the field is optional) crashed the list.
  it('does not crash for an episode without a speakers array', async () => {
    mockApi({ 'GET /podcast': () => jsonResponse([makeEpisode({ title: 'Ohne Sprecher', duration: '1:00' })]) });
    render(<PodcastList />);
    expect(await screen.findByRole('link', { name: /Ohne Sprecher/ })).toBeInTheDocument();
  });
});

describe('SpeakerPills', () => {
  const names = () => screen.getAllByText(/./).map((el) => el.textContent);

  it('renders nothing without speakers', () => {
    const { container } = render(<SpeakerPills speakers={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('puts main speakers first and highlights them', () => {
    render(<SpeakerPills speakers={[{ name: 'Ben' }, { name: 'Anna', main: true }, { name: 'Cleo' }]} />);
    expect(names()).toEqual(['Anna', 'Ben', 'Cleo']);
    expect(screen.getByText('Anna')).toHaveClass('font-bold');
    expect(screen.getByText('Ben')).not.toHaveClass('font-bold');
  });

  it('treats a lone speaker as featured even without the main flag', () => {
    render(<SpeakerPills speakers={[{ name: 'Solo' }]} />);
    expect(screen.getByText('Solo')).toHaveClass('font-bold');
  });
});

describe('Breadcrumbs', () => {
  it('renders links for items with an href and marks the last plain item as the current page', () => {
    render(
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Angebote', href: '/angebote' }, { label: 'X' }]} />,
    );
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Angebote' })).toHaveAttribute('href', '/angebote');
    expect(screen.getByText('X')).toHaveAttribute('aria-current', 'page');
  });
});
