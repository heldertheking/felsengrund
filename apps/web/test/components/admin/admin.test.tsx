import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminApp from '../../../src/components/admin/AdminApp';
import OffersManager from '../../../src/components/admin/OffersManager';
import PodcastManager from '../../../src/components/admin/PodcastManager';
import { getAdminToken, setAdminToken } from '../../../src/lib/api';
import * as exporter from '../../../src/lib/export';
import { makeEpisode, makeOffer } from '../../fixtures';
import { jsonResponse, mockApi, useNativeFormData } from '../../helpers';

beforeEach(async () => {
  await useNativeFormData();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

/** The admin forms use `<label>` without `for`, so find the control that shares the label's wrapper. */
function control(label: string | RegExp): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  const labelEl = screen.getByText(label, { selector: 'label, span' });
  return labelEl.parentElement!.querySelector('input, textarea, select')!;
}

/** Sets a controlled input's value directly; typing character by character is not what these tests are about. */
function fill(el: HTMLElement, value: string) {
  fireEvent.change(el, { target: { value } });
}

async function formDataOf(request: Request) {
  return request.formData();
}

describe('AdminApp', () => {
  it('shows the login form without a token and keeps the version visible', () => {
    render(<AdminApp />);
    expect(screen.getByLabelText('Passwort')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeInTheDocument();
    expect(screen.getByText(/^Version \d+\.\d+\.\d+/)).toBeInTheDocument();
  });

  it('logs in, stores the token and shows the offers manager', async () => {
    const { calls } = mockApi({
      'POST /admin/login': () => jsonResponse({ token: 'tok-123' }),
      'GET /offers': () => jsonResponse([makeOffer({ title: 'Sonntag' })]),
    });
    render(<AdminApp />);

    fill(screen.getByLabelText('Passwort'), 'geheim');
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(await screen.findByText('Sonntag')).toBeInTheDocument();
    expect(getAdminToken()).toBe('tok-123');
    expect((await formDataOf(calls[0])).get('password')).toBe('geheim');
  });

  it('shows the API message for a wrong password and stays on the login form', async () => {
    mockApi({ 'POST /admin/login': () => jsonResponse({ message: 'Falsches Passwort.' }, 401) });
    render(<AdminApp />);

    fill(screen.getByLabelText('Passwort'), 'falsch');
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Falsches Passwort.');
    expect(getAdminToken()).toBeNull();
    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeEnabled();
  });

  it('starts logged in when a token is stored, switches views and logs out', async () => {
    setAdminToken('tok');
    mockApi({
      'GET /offers': () => jsonResponse([]),
      'GET /podcast': () => jsonResponse([makeEpisode({ title: 'Folge Eins' })]),
    });
    render(<AdminApp />);

    expect(await screen.findByRole('heading', { name: 'Angebote' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Podcast' }));
    expect(await screen.findByText('Folge Eins')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Abmelden' }));
    expect(screen.getByLabelText('Passwort')).toBeInTheDocument();
    expect(getAdminToken()).toBeNull();
  });

  it('returns to the login form when a request is rejected with 401', async () => {
    setAdminToken('expired');
    mockApi({
      'GET /offers': () => jsonResponse([makeOffer({ slug: 'a', title: 'Alpha' })]),
      'DELETE /admin/offers/a': () => jsonResponse({ message: 'x' }, 401),
    });
    vi.stubGlobal('confirm', () => true);
    render(<AdminApp />);

    await userEvent.click(await screen.findByRole('button', { name: 'Löschen' }));

    expect(await screen.findByLabelText('Passwort')).toBeInTheDocument();
    expect(getAdminToken()).toBeNull();
  });
});

describe('OffersManager', () => {
  const offers = [
    makeOffer({ slug: 'alpha', title: 'Alpha', body: 'A-Text' }),
    makeOffer({ slug: 'beta', title: 'Beta', body: 'B-Text' }),
  ];

  it('lists offers, and shows an error when loading fails', async () => {
    mockApi({ 'GET /offers': () => jsonResponse(offers) });
    const { unmount } = render(<OffersManager onUnauthorized={vi.fn()} />);
    expect(screen.getByText('Wird geladen …')).toBeInTheDocument();
    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();
    unmount();

    mockApi({ 'GET /offers': () => jsonResponse({ message: 'x' }, 500) });
    render(<OffersManager onUnauthorized={vi.fn()} />);
    expect(await screen.findByText('Angebote konnten nicht geladen werden.')).toBeInTheDocument();
  });

  it('shows an empty-state row when there are no offers', async () => {
    mockApi({ 'GET /offers': () => jsonResponse([]) });
    render(<OffersManager onUnauthorized={vi.fn()} />);
    expect(await screen.findByText('Noch keine Angebote.')).toBeInTheDocument();
  });

  it('deletes a single offer after confirmation and reloads, but not when cancelled', async () => {
    let list = offers;
    const { calls } = mockApi({
      'GET /offers': () => jsonResponse(list),
      'DELETE /admin/offers/alpha': () => {
        list = [offers[1]];
        return jsonResponse({ ok: true });
      },
    });
    const confirmFn = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.stubGlobal('confirm', confirmFn);
    render(<OffersManager onUnauthorized={vi.fn()} />);

    const row = (await screen.findByText('Alpha')).closest('li')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Löschen' }));
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);

    await userEvent.click(within(row).getByRole('button', { name: 'Löschen' }));
    await waitFor(() => expect(screen.queryByText('Alpha')).not.toBeInTheDocument());
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('selects rows, offers bulk export with the selected data and bulk delete', async () => {
    const exportSpy = vi.spyOn(exporter, 'downloadMdocExport').mockImplementation(() => {});
    const { calls } = mockApi({
      'GET /offers': () => jsonResponse(offers),
      'DELETE /admin/offers/alpha': () => jsonResponse({ ok: true }),
      'DELETE /admin/offers/beta': () => jsonResponse({ ok: true }),
    });
    vi.stubGlobal('confirm', () => true);
    render(<OffersManager onUnauthorized={vi.fn()} />);
    await screen.findByText('Alpha');

    await userEvent.click(screen.getByLabelText('Alle auswählen'));
    expect(screen.getByText('2 ausgewählt')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Alle auswählen'));
    expect(screen.queryByText(/ausgewählt$/)).not.toBeInTheDocument();

    const [, firstRowBox] = screen.getAllByRole('checkbox');
    await userEvent.click(firstRowBox);
    await userEvent.click(screen.getByRole('button', { name: 'Exportieren' }));
    expect(exportSpy).toHaveBeenCalledWith('angebote-export', [
      { slug: 'alpha', data: offers[0].data, body: 'A-Text' },
    ]);

    await userEvent.click(screen.getByLabelText('Alle auswählen'));
    // The header action row has its own "Löschen" next to "Exportieren".
    const bulkDelete = screen.getByRole('button', { name: 'Exportieren' }).nextElementSibling as HTMLElement;
    await userEvent.click(bulkDelete);
    await waitFor(() => expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(2));
  });

  it('imports only .mdoc files and reports per-file failures', async () => {
    const posts: string[] = [];
    mockApi({
      'GET /offers': () => jsonResponse(offers),
      'POST /admin/offers/import': async (request) => {
        const file = (await request.formData()).get('file') as File;
        posts.push(file.name);
        return file.name === 'bad.mdoc' ? jsonResponse({ message: 'Ungültig.' }, 400) : jsonResponse({ ok: true });
      },
    });
    render(<OffersManager onUnauthorized={vi.fn()} />);
    await screen.findByText('Alpha');
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;

    await userEvent.upload(
      input,
      [new File(['x'], 'ok.mdoc'), new File(['x'], 'bad.mdoc'), new File(['x'], 'notes.txt')],
      { applyAccept: false },
    );

    expect(await screen.findByText('bad.mdoc: Ungültig.')).toBeInTheDocument();
    expect(posts).toEqual(['ok.mdoc', 'bad.mdoc']);
  });

  it('says so when no .mdoc file was picked', async () => {
    const { calls } = mockApi({ 'GET /offers': () => jsonResponse(offers) });
    render(<OffersManager onUnauthorized={vi.fn()} />);
    await screen.findByText('Alpha');

    await userEvent.upload(document.querySelector<HTMLInputElement>('input[type="file"]')!, new File(['x'], 'a.txt'), {
      applyAccept: false,
    });

    expect(await screen.findByText('Keine .mdoc-Dateien gefunden.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('creates an offer from the form, sending multipart fields and dropping unnamed organizers', async () => {
    let body!: FormData;
    mockApi({
      'GET /offers': () => jsonResponse(offers),
      'POST /admin/offers': async (request) => {
        body = await formDataOf(request);
        return jsonResponse({ slug: 'neu' });
      },
    });
    render(<OffersManager onUnauthorized={vi.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Neues Angebot' }));

    expect(screen.getByRole('heading', { name: 'Neues Angebot' })).toBeInTheDocument();
    fill(control('Titel'), 'Neu');
    await userEvent.selectOptions(control('Kategorie'), 'Senioren');
    fill(control('Ort'), 'Kirche');
    await userEvent.click(screen.getByRole('button', { name: 'Ansprechperson hinzufügen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ansprechperson hinzufügen' }));
    const [name1, , , name2] = screen.getAllByPlaceholderText(/^(Name|Rolle|Kontakt)$/);
    fill(name1, 'Anna');
    expect(name2).toHaveValue('');
    fill(control(/Inhalt/), 'Hallo');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    // Back on the list after saving.
    expect(await screen.findByRole('heading', { name: 'Angebote' })).toBeInTheDocument();
    expect(body.get('title')).toBe('Neu');
    expect(body.get('category')).toBe('senioren');
    expect(body.get('location')).toBe('Kirche');
    expect(body.get('body')).toBe('Hallo');
    expect(body.has('slug')).toBe(false);
    expect(JSON.parse(body.get('organizers') as string)).toEqual([{ name: 'Anna' }]);
  });

  it('edits an existing offer, prefilled and keyed by its slug, and surfaces API errors', async () => {
    let body!: FormData;
    mockApi({
      'GET /offers': () => jsonResponse(offers),
      'POST /admin/offers': async (request) => {
        body = await formDataOf(request);
        return jsonResponse({ message: 'Titel existiert bereits.' }, 409);
      },
    });
    render(<OffersManager onUnauthorized={vi.fn()} />);
    const row = (await screen.findByText('Alpha')).closest('li')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Bearbeiten' }));

    expect(screen.getByRole('heading', { name: 'Angebot bearbeiten' })).toBeInTheDocument();
    expect(control('Titel')).toHaveValue('Alpha');
    expect(screen.getByText('alpha', { selector: 'code' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Titel existiert bereits.')).toBeInTheDocument();
    expect(body.get('slug')).toBe('alpha');
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeEnabled();
  });

  it('can go back to the list from the form', async () => {
    mockApi({ 'GET /offers': () => jsonResponse(offers) });
    render(<OffersManager onUnauthorized={vi.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Neues Angebot' }));
    await userEvent.click(screen.getByRole('button', { name: 'Zurück zur Liste' }));
    expect(await screen.findByRole('heading', { name: 'Angebote' })).toBeInTheDocument();
  });

  it('calls onUnauthorized when saving is rejected with 401', async () => {
    const onUnauthorized = vi.fn();
    setAdminToken('expired');
    mockApi({ 'GET /offers': () => jsonResponse([]), 'POST /admin/offers': () => jsonResponse({}, 401) });
    render(<OffersManager onUnauthorized={onUnauthorized} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Neues Angebot' }));
    fill(control('Titel'), 'X');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });
});

describe('PodcastManager', () => {
  const episodes = [
    makeEpisode({ slug: 'folge-1', title: 'Folge 1', episodeNumber: 1 }),
    makeEpisode({ slug: 'folge-2', title: 'Folge 2', episodeNumber: 5 }),
  ];

  it('lists episodes and prefills the next episode number (highest + 1) for a new one', async () => {
    mockApi({ 'GET /podcast': () => jsonResponse(episodes) });
    render(<PodcastManager onUnauthorized={vi.fn()} />);
    expect(await screen.findByText('Folge 2')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Neue Episode' }));

    expect(control('Episodennummer')).toHaveValue(6);
  });

  it('requires an audio file for new episodes and not for edits', async () => {
    mockApi({ 'GET /podcast': () => jsonResponse(episodes) });
    render(<PodcastManager onUnauthorized={vi.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Neue Episode' }));
    expect(screen.getByText('Audiodatei (erforderlich)')).toBeInTheDocument();
    expect(document.querySelector('input[type="file"][accept="audio/*"]')).toBeRequired();

    await userEvent.click(screen.getByRole('button', { name: 'Zurück zur Liste' }));
    const row = (await screen.findByText('Folge 1')).closest('li')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Bearbeiten' }));
    expect(screen.getByText('Leer lassen, um die bestehende Datei zu behalten.')).toBeInTheDocument();
    expect(document.querySelector('input[type="file"][accept="audio/*"]')).not.toBeRequired();
  });

  it('creates an episode with audio, speakers and a trimmed speaker list', async () => {
    let body!: FormData;
    mockApi({
      'GET /podcast': () => jsonResponse(episodes),
      'POST /admin/podcast': async (request) => {
        body = await formDataOf(request);
        return jsonResponse({ slug: 'neu' });
      },
    });
    render(<PodcastManager onUnauthorized={vi.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Neue Episode' }));

    fill(control('Titel'), 'Neue Folge');
    fireEvent.change(control('Veröffentlichungsdatum'), { target: { value: '2026-05-01' } });
    await userEvent.upload(
      document.querySelector('input[type="file"][accept="audio/*"]')!,
      new File(['a'], 'a.mp3', { type: 'audio/mpeg' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Sprecher hinzufügen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sprecher hinzufügen' }));
    const names = screen.getAllByPlaceholderText('Name');
    fill(names[0], 'Anna');
    await userEvent.click(screen.getAllByLabelText('Hauptsprecher')[0]);
    // jsdom's constraint validation does not see files set by user-event, so submit past it (the browser
    // enforces `required`; the component's own "no audio" check is covered below).
    fireEvent.submit(control('Titel').closest('form')!);

    expect(await screen.findByRole('heading', { name: 'Podcast' })).toBeInTheDocument();
    expect(body.get('title')).toBe('Neue Folge');
    expect(body.get('publishDate')).toBe('2026-05-01');
    expect(body.get('episodeNumber')).toBe('6');
    expect((body.get('audio') as File).name).toBe('a.mp3');
    expect(JSON.parse(body.get('speakers') as string)).toEqual([{ name: 'Anna', main: true }]);
  });

  it('refuses to create an episode without audio', async () => {
    const { calls } = mockApi({ 'GET /podcast': () => jsonResponse(episodes) });
    render(<PodcastManager onUnauthorized={vi.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Neue Episode' }));
    fill(control('Titel'), 'Ohne Audio');

    fireEvent.submit(control('Titel').closest('form')!);

    expect(await screen.findByText('Bitte eine Audiodatei auswählen.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('fills the duration from the audio file metadata', async () => {
    mockApi({ 'GET /podcast': () => jsonResponse([]) });
    const probes: HTMLAudioElement[] = [];
    vi.stubGlobal(
      'Audio',
      class {
        preload = '';
        src = '';
        duration = 125.4;
        onloadedmetadata: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor() {
          probes.push(this as unknown as HTMLAudioElement);
        }
      },
    );
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    render(<PodcastManager onUnauthorized={vi.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Neue Episode' }));

    await userEvent.upload(
      document.querySelector('input[type="file"][accept="audio/*"]')!,
      new File(['a'], 'a.mp3', { type: 'audio/mpeg' }),
    );
    (probes[0] as unknown as { onloadedmetadata: () => void }).onloadedmetadata();

    await waitFor(() => expect(control(/Dauer/)).toHaveValue('2:05'));
  });

  it('exports selected episodes', async () => {
    const exportSpy = vi.spyOn(exporter, 'downloadMdocExport').mockImplementation(() => {});
    mockApi({ 'GET /podcast': () => jsonResponse(episodes) });
    render(<PodcastManager onUnauthorized={vi.fn()} />);
    await screen.findByText('Folge 1');

    await userEvent.click(screen.getByLabelText('Alle auswählen'));
    await userEvent.click(screen.getByRole('button', { name: 'Exportieren' }));

    expect(exportSpy).toHaveBeenCalledTimes(1);
    expect(exportSpy.mock.calls[0][1].map((e) => e.slug)).toEqual(['folge-1', 'folge-2']);
  });

  it('deletes an episode after confirmation', async () => {
    const { calls } = mockApi({
      'GET /podcast': () => jsonResponse(episodes),
      'DELETE /admin/podcast/folge-1': () => jsonResponse({ ok: true }),
    });
    vi.stubGlobal('confirm', () => true);
    render(<PodcastManager onUnauthorized={vi.fn()} />);
    const row = (await screen.findByText('Folge 1')).closest('li')!;

    await userEvent.click(within(row).getByRole('button', { name: 'Löschen' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
  });
});
