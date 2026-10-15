import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageCropField } from '../../../src/components/admin/ImageCropField';
import { Optional, OptionalNote } from '../../../src/components/admin/FieldHints';
import OffersManager from '../../../src/components/admin/OffersManager';
import PodcastManager from '../../../src/components/admin/PodcastManager';
import { makeEpisode, makeOffer } from '../../fixtures';
import { jsonResponse, mockApi } from '../../helpers';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** Every visible form control must have a linked `<label>` or an explicit `aria-label`. */
function expectAllControlsNamed(form: HTMLElement) {
  const controls = Array.from(form.querySelectorAll<Control>('input, textarea, select'));
  expect(controls.length).toBeGreaterThan(0);
  for (const el of controls) {
    const named = (el.labels?.length ?? 0) > 0 || Boolean(el.getAttribute('aria-label'));
    expect(named, `control without label: ${el.outerHTML.slice(0, 120)}`).toBe(true);
  }
}

/** `getByLabelText` over `Name(optional)`: the tag is part of the label text. */
function optionalLabel(name: string) {
  return new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(optional\\)$`);
}

async function openOfferForm(offer = false) {
  mockApi({ 'GET /offers': () => jsonResponse(offer ? [makeOffer({ slug: 'alpha', title: 'Alpha' })] : []) });
  render(<OffersManager onUnauthorized={vi.fn()} />);
  if (offer) await userEvent.click(await screen.findByRole('button', { name: 'Bearbeiten' }));
  else await userEvent.click(await screen.findByRole('button', { name: 'Neues Angebot' }));
  return document.querySelector('form') as HTMLFormElement;
}

async function openPodcastForm(edit = false) {
  mockApi({ 'GET /podcast': () => jsonResponse(edit ? [makeEpisode({ slug: 'f1', title: 'F1' })] : []) });
  render(<PodcastManager onUnauthorized={vi.fn()} />);
  if (edit) await userEvent.click(await screen.findByRole('button', { name: 'Bearbeiten' }));
  else await userEvent.click(await screen.findByRole('button', { name: 'Neue Episode' }));
  return document.querySelector('form') as HTMLFormElement;
}

describe('FieldHints', () => {
  it('Optional renders the "(optional)" tag', () => {
    render(<Optional />);
    expect(screen.getByText('(optional)')).toBeInTheDocument();
  });

  it('OptionalNote names the required fields and says everything else is optional', () => {
    render(<OptionalNote required="Titel und Kategorie" />);
    const note = screen.getByText(/Pflichtfelder:/).closest('p')!;
    expect(note).toHaveTextContent('Pflichtfelder: Titel und Kategorie.');
    expect(within(note).getByText('optional')).toBeInTheDocument();
    expect(note).toHaveTextContent('wird auf der Webseite einfach nicht angezeigt');
    expect(note).toHaveAttribute('data-guide', 'optional-note');
  });
});

describe('offer form labels and hints', () => {
  it('marks Titel and Kategorie as required and everything else as optional', async () => {
    await openOfferForm();

    expect(screen.getByText(/Pflichtfelder:/).closest('p')).toHaveTextContent('Titel und Kategorie');
    expect(screen.getByLabelText('Titel *')).toBeRequired();
    expect(screen.getByLabelText('Kategorie *')).toBeInTheDocument();
    for (const name of [
      'Intro',
      'Zielgruppe',
      'Zeiten',
      'Ort',
      'Google Maps Link',
      'Google Maps Iframe URL',
      'Anmeldung',
      'Kartenbild',
    ]) {
      expect(screen.getByLabelText(optionalLabel(name)), name).toBeInTheDocument();
    }
    expect(screen.getByRole('group', { name: optionalLabel('Ansprechpersonen') })).toBeInTheDocument();
    expect(screen.getAllByText('(optional)')).toHaveLength(9);
  });

  it('links every control to its label', async () => {
    const form = await openOfferForm();
    expectAllControlsNamed(form);
    expect(screen.getByLabelText('Titel *')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Kategorie *').tagName).toBe('SELECT');
    expect(screen.getByLabelText(optionalLabel('Intro')).tagName).toBe('TEXTAREA');
    expect(screen.getByLabelText(optionalLabel('Kartenbild'))).toHaveAttribute('type', 'file');
    expect(screen.getByLabelText('Inhalt (Markdoc)').tagName).toBe('TEXTAREA');
  });

  it('focuses the control when its label is clicked', async () => {
    await openOfferForm();
    await userEvent.click(screen.getByText('Titel *'));
    expect(screen.getByLabelText('Titel *')).toHaveFocus();
    await userEvent.click(screen.getByText('Kategorie *'));
    expect(screen.getByLabelText('Kategorie *')).toHaveFocus();
  });

  it('gives organizer inputs a name that says which person they belong to', async () => {
    await openOfferForm();
    const add = screen.getByRole('button', { name: 'Ansprechperson hinzufügen' });
    await userEvent.click(add);
    await userEvent.click(add);

    const group = screen.getByRole('group', { name: optionalLabel('Ansprechpersonen') });
    for (const n of [1, 2]) {
      expect(within(group).getByLabelText(`Ansprechperson ${n}: Name`)).toBeInTheDocument();
      expect(within(group).getByLabelText(`Ansprechperson ${n}: Rolle`)).toBeInTheDocument();
      expect(within(group).getByLabelText(`Ansprechperson ${n}: Kontakt`)).toBeInTheDocument();
      expect(within(group).getByRole('button', { name: `Ansprechperson ${n} entfernen` })).toBeInTheDocument();
    }
  });

  it('uses unique ids across two forms rendered at once', async () => {
    await openOfferForm();
    render(<OffersManager onUnauthorized={vi.fn()} />);
    await userEvent.click((await screen.findAllByRole('button', { name: 'Neues Angebot' }))[0]);

    const ids = Array.from(document.querySelectorAll('[id]'), (el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('links the form to the offers guide in a new tab', async () => {
    await openOfferForm();
    const link = screen.getByRole('link', { name: 'Anleitung ansehen' });
    expect(link).toHaveAttribute('href', '/admin/anleitungen/angebote');
    expect(link).toHaveAttribute('target', '_blank');
  });
});

describe('podcast form labels and hints', () => {
  it('marks Titel, Veröffentlichungsdatum and the audio file as required for a new episode', async () => {
    const form = await openPodcastForm();

    expect(screen.getByText(/Pflichtfelder:/).closest('p')).toHaveTextContent('Audiodatei');
    expect(screen.getByLabelText('Titel *')).toBeRequired();
    expect(screen.getByLabelText('Veröffentlichungsdatum *')).toBeRequired();
    expect(screen.getByLabelText('Audiodatei *')).toBeRequired();
    for (const name of ['Episodennummer', 'Dauer (z. B. 32:10)', 'Cover-Bild']) {
      expect(screen.getByLabelText(optionalLabel(name)), name).toBeInTheDocument();
    }
    expect(screen.getByRole('group', { name: optionalLabel('Sprecher') })).toBeInTheDocument();
    expect(screen.getAllByText('(optional)')).toHaveLength(4);
    expectAllControlsNamed(form);
  });

  it('turns the audio file optional when editing', async () => {
    const form = await openPodcastForm(true);

    const audio = screen.getByLabelText(optionalLabel('Audiodatei'));
    expect(audio).not.toBeRequired();
    expect(screen.queryByLabelText('Audiodatei *')).not.toBeInTheDocument();
    expect(screen.getAllByText('(optional)')).toHaveLength(5);
    expectAllControlsNamed(form);
  });

  it('names the speaker inputs by position', async () => {
    await openPodcastForm();
    const add = screen.getByRole('button', { name: 'Sprecher hinzufügen' });
    await userEvent.click(add);
    await userEvent.click(add);

    const group = screen.getByRole('group', { name: optionalLabel('Sprecher') });
    expect(within(group).getByLabelText('Sprecher 1: Name')).toBeInTheDocument();
    expect(within(group).getByLabelText('Sprecher 2: Name')).toBeInTheDocument();
    expect(within(group).getAllByLabelText('Hauptsprecher')).toHaveLength(2);
    expect(within(group).getByRole('button', { name: 'Sprecher 2 entfernen' })).toBeInTheDocument();
  });

  it('links the form to the podcast guide in a new tab', async () => {
    await openPodcastForm();
    const link = screen.getByRole('link', { name: 'Anleitung ansehen' });
    expect(link).toHaveAttribute('href', '/admin/anleitungen/podcast');
    expect(link).toHaveAttribute('target', '_blank');
  });
});

describe('ImageCropField', () => {
  it('links its label to the file input and shows the optional tag', () => {
    render(<ImageCropField label="Kartenbild" aspect={16 / 9} maxOutputSize={1600} onChange={vi.fn()} />);

    const input = screen.getByLabelText(optionalLabel('Kartenbild'));
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', 'image/*');
  });

  it('shows the stored image as a decorative preview', () => {
    render(
      <ImageCropField label="Cover-Bild" aspect={1} maxOutputSize={1400} currentUrl="/img/c.jpg" onChange={vi.fn()} />,
    );
    expect(document.querySelector('img')).toHaveAttribute('src', '/img/c.jpg');
    expect(screen.getByLabelText(optionalLabel('Cover-Bild'))).toBeInTheDocument();
  });
});
