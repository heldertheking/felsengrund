import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminApp from '../../../src/components/admin/AdminApp';
import { setAdminToken } from '../../../src/lib/api';
import { GUIDES } from '../../../src/lib/guides';
import { makeEpisode, makeOffer } from '../../fixtures';
import { jsonResponse, mockApi } from '../../helpers';

let scrollTo: ReturnType<typeof vi.fn>;

beforeEach(() => {
  setAdminToken('tok');
  mockApi({
    'GET /offers': () => jsonResponse([makeOffer({ title: 'Sonntag' })]),
    'GET /podcast': () => jsonResponse([makeEpisode({ title: 'Folge Eins' })]),
  });
  scrollTo = vi.fn();
  vi.stubGlobal('scrollTo', scrollTo);
  // The admin only pushes /admin/* URLs; start every test from a known location.
  window.history.replaceState({}, '', '/admin');
});

function visit(path: string) {
  window.history.replaceState({}, '', path);
  return render(<AdminApp />);
}

function heading2(name: string) {
  return screen.findByRole('heading', { level: 2, name });
}

describe('AdminApp view routing from the URL', () => {
  it('shows the offers list for /admin', async () => {
    visit('/admin');
    expect(await heading2('Angebote')).toBeInTheDocument();
    expect(await screen.findByText('Sonntag')).toBeInTheDocument();
  });

  it('shows the podcast list for /admin/podcast', async () => {
    visit('/admin/podcast');
    expect(await heading2('Podcast')).toBeInTheDocument();
    expect(await screen.findByText('Folge Eins')).toBeInTheDocument();
  });

  it('shows the guides index for /admin/anleitungen', async () => {
    visit('/admin/anleitungen');
    expect(await heading2('Anleitungen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(GUIDES.podcast.title) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(GUIDES.offers.title) })).toBeInTheDocument();
  });

  it('shows the podcast guide for /admin/anleitungen/podcast', async () => {
    visit('/admin/anleitungen/podcast');
    expect(await heading2(GUIDES.podcast.title)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '← Alle Anleitungen' })).toBeInTheDocument();
    expect(document.querySelector('video source')).toHaveAttribute('src', GUIDES.podcast.video.src);
  });

  it('shows the offers guide for /admin/anleitungen/angebote', async () => {
    visit('/admin/anleitungen/angebote');
    expect(await heading2(GUIDES.offers.title)).toBeInTheDocument();
    expect(document.querySelector('video source')).toHaveAttribute('src', GUIDES.offers.video.src);
  });

  it('ignores a trailing slash', async () => {
    visit('/admin/podcast/');
    expect(await heading2('Podcast')).toBeInTheDocument();
  });

  it('falls back to the offers list for an unknown path', async () => {
    visit('/admin/gibt-es-nicht');
    expect(await heading2('Angebote')).toBeInTheDocument();
  });

  it('puts the matching tail into the breadcrumbs', async () => {
    visit('/admin/anleitungen/podcast');
    await heading2(GUIDES.podcast.title);
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(crumbs).toHaveTextContent(`Home/Admin/Anleitungen/${GUIDES.podcast.title}`);
    expect(screen.getByRole('link', { name: 'Anleitungen' })).toHaveAttribute('href', '/admin/anleitungen');
  });

  it('marks the Anleitungen tab active on guide pages only', async () => {
    visit('/admin/anleitungen/angebote');
    await heading2(GUIDES.offers.title);
    const tab = (name: string) => screen.getByRole('button', { name });
    expect(tab('Anleitungen')).toHaveClass('text-kf-accent');
    expect(tab('Angebote')).not.toHaveClass('text-kf-accent');
    expect(tab('Podcast')).not.toHaveClass('text-kf-accent');
  });
});

describe('AdminApp navigation', () => {
  it('pushes the URL of each view and scrolls to the top', async () => {
    visit('/admin');
    await heading2('Angebote');

    await userEvent.click(screen.getByRole('button', { name: 'Podcast' }));
    expect(window.location.pathname).toBe('/admin/podcast');
    expect(await heading2('Podcast')).toBeInTheDocument();
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0 });

    await userEvent.click(screen.getByRole('button', { name: 'Anleitungen' }));
    expect(window.location.pathname).toBe('/admin/anleitungen');
    expect(await heading2('Anleitungen')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: new RegExp(GUIDES.offers.title) }));
    expect(window.location.pathname).toBe('/admin/anleitungen/angebote');
    expect(await heading2(GUIDES.offers.title)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '← Alle Anleitungen' }));
    expect(window.location.pathname).toBe('/admin/anleitungen');

    await userEvent.click(screen.getByRole('button', { name: new RegExp(GUIDES.podcast.title) }));
    expect(window.location.pathname).toBe('/admin/anleitungen/podcast');

    await userEvent.click(screen.getByRole('button', { name: 'Angebote' }));
    expect(window.location.pathname).toBe('/admin');
    expect(await heading2('Angebote')).toBeInTheDocument();
  });

  it('adds a history entry per navigation', async () => {
    visit('/admin');
    await heading2('Angebote');
    const before = window.history.length;

    await userEvent.click(screen.getByRole('button', { name: 'Podcast' }));

    expect(window.history.length).toBe(before + 1);
  });

  it('follows the browser back button (popstate)', async () => {
    visit('/admin');
    await heading2('Angebote');
    await userEvent.click(screen.getByRole('button', { name: 'Podcast' }));
    await heading2('Podcast');

    act(() => {
      window.history.replaceState({}, '', '/admin');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(await heading2('Angebote')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Podcast' })).not.toBeInTheDocument();
  });

  it('switches to a guide on popstate and stops listening after unmount', async () => {
    const { unmount } = visit('/admin');
    await heading2('Angebote');

    act(() => {
      window.history.replaceState({}, '', '/admin/anleitungen/podcast');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(await heading2(GUIDES.podcast.title)).toBeInTheDocument();

    const remove = vi.spyOn(window, 'removeEventListener');
    unmount();
    expect(remove).toHaveBeenCalledWith('popstate', expect.any(Function));
  });

  it('shows the login form without a token whatever the URL, and keeps the URL', () => {
    localStorage.clear();
    visit('/admin/anleitungen');
    expect(screen.getByLabelText('Passwort')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/admin/anleitungen');
  });
});
