import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import GuidePage from '../../../src/components/admin/GuidePage';
import GuidesIndex from '../../../src/components/admin/GuidesIndex';
import { formatTime, GUIDES, GUIDE_ORDER } from '../../../src/lib/guides';
import { MARKDOWN_ACTIONS } from '../../../src/lib/markdown-actions';

describe('GuidesIndex', () => {
  it('lists a card per guide in GUIDE_ORDER with poster, summary, duration and step count', () => {
    render(<GuidesIndex onOpen={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Anleitungen' })).toBeInTheDocument();
    const cards = screen.getAllByRole('button');
    expect(cards).toHaveLength(GUIDE_ORDER.length);

    GUIDE_ORDER.forEach((id, index) => {
      const guide = GUIDES[id];
      const card = cards[index];
      expect(card).toHaveTextContent(guide.title);
      expect(card).toHaveTextContent(guide.summary);
      expect(card).toHaveTextContent(`${guide.steps.length} Schritte`);
      expect(card).toHaveTextContent(`(${formatTime(guide.video.duration!)} Min.)`);
      expect(card.querySelector('img')).toHaveAttribute('src', guide.video.poster);
    });
  });

  it('opens the clicked guide by id', async () => {
    const onOpen = vi.fn();
    render(<GuidesIndex onOpen={onOpen} />);

    await userEvent.click(screen.getByRole('button', { name: new RegExp(GUIDES.podcast.title) }));
    expect(onOpen).toHaveBeenCalledWith('podcast');

    await userEvent.click(screen.getByRole('button', { name: new RegExp(GUIDES.offers.title) }));
    expect(onOpen).toHaveBeenLastCalledWith('offers');
  });
});

describe.each(GUIDE_ORDER)('GuidePage (%s)', (id) => {
  const guide = GUIDES[id];
  const timed = guide.steps.map((step, index) => ({ step, index })).filter(({ step }) => step.start !== undefined);
  let play: Mock<() => Promise<void>>;
  let scrollIntoView: Mock<() => void>;

  beforeEach(() => {
    // jsdom implements neither media playback nor scrollIntoView.
    play = vi.fn<() => Promise<void>>(() => Promise.resolve());
    scrollIntoView = vi.fn<() => void>();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play);
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  function video() {
    return document.querySelector('video') as HTMLVideoElement;
  }

  /** jsdom's media element has no playback clock, so give the element a settable currentTime. */
  function mockClock(el: HTMLVideoElement, initial = 0) {
    let time = initial;
    Object.defineProperty(el, 'currentTime', {
      configurable: true,
      get: () => time,
      set: (value: number) => {
        time = value;
      },
    });
    return {
      get: () => time,
      tick(next: number) {
        time = next;
        fireEvent.timeUpdate(el);
      },
    };
  }

  it('renders the title, summary, video source and poster', () => {
    render(<GuidePage guide={guide} />);

    expect(screen.getByRole('heading', { level: 2, name: guide.title })).toBeInTheDocument();
    expect(screen.getByText(guide.summary)).toBeInTheDocument();
    expect(video()).toHaveAttribute('poster', guide.video.poster);
    expect(video().querySelector('source')).toHaveAttribute('src', guide.video.src);
    expect(video().querySelector('source')).toHaveAttribute('type', 'video/mp4');
    expect(screen.getByText(new RegExp(`Dauer ${formatTime(guide.video.duration!)} Min.`))).toBeInTheDocument();
  });

  it('has no <track> element: the videos are silent and captioned in the picture', () => {
    render(<GuidePage guide={guide} />);
    expect(video().querySelector('track')).toBeNull();
  });

  it('renders every step with number, title, text and the Pflicht/optional tag', () => {
    render(<GuidePage guide={guide} />);
    const items = document.querySelectorAll('ol > li');
    expect(items).toHaveLength(guide.steps.length);

    guide.steps.forEach((step, index) => {
      const item = within(items[index] as HTMLElement);
      expect(item.getByRole('heading', { level: 4, name: step.title })).toBeInTheDocument();
      expect(item.getByText(step.text)).toBeInTheDocument();
      expect(items[index]).toHaveTextContent(String(index + 1));
      if (step.required === 'pflicht') expect(item.getByText('Pflicht')).toBeInTheDocument();
      else if (step.required === 'optional') expect(item.getByText('optional')).toBeInTheDocument();
      else expect(item.queryByText('Pflicht')).not.toBeInTheDocument();
    });
  });

  it('offers a timestamp button per timed step labelled with the formatted time', () => {
    render(<GuidePage guide={guide} />);
    for (const { step, index } of timed) {
      const button = screen.getByRole('button', { name: `Video ab Schritt ${index + 1} abspielen` });
      expect(button).toHaveTextContent(formatTime(step.start!));
    }
  });

  it('seeks the video to the step start, plays it and scrolls it into view', async () => {
    render(<GuidePage guide={guide} />);
    const clock = mockClock(video());
    const { step, index } = timed[2];

    await userEvent.click(screen.getByRole('button', { name: `Video ab Schritt ${index + 1} abspielen` }));

    expect(clock.get()).toBe(step.start);
    expect(play).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });

  it('survives a rejected play() (autoplay blocked)', async () => {
    play.mockImplementation(() => Promise.reject(new Error('NotAllowedError')));
    render(<GuidePage guide={guide} />);
    mockClock(video());
    const { index } = timed[0];

    await userEvent.click(screen.getByRole('button', { name: `Video ab Schritt ${index + 1} abspielen` }));

    expect(play).toHaveBeenCalled();
  });

  it('highlights no step before the first timestamp and follows the playback position', () => {
    render(<GuidePage guide={guide} />);
    const clock = mockClock(video());
    const items = Array.from(document.querySelectorAll('ol > li'));
    const active = () => items.map((el) => el.classList.contains('border-kf-accent'));
    const none = guide.steps.map(() => false);
    const only = (index: number) => guide.steps.map((_, i) => i === index);

    expect(active()).toEqual(none);

    clock.tick(0);
    expect(active()).toEqual(none);

    const first = timed[0];
    const third = timed[2];
    clock.tick(first.step.start!);
    expect(active()).toEqual(only(first.index));

    clock.tick(third.step.start! + 1);
    expect(active()).toEqual(only(third.index));

    // Within 0.2 s before a step starts it already counts as active.
    const next = timed[3];
    clock.tick(next.step.start! - 0.1);
    expect(active()).toEqual(only(next.index));

    // Seeking back removes the later highlight again.
    clock.tick(0);
    expect(active()).toEqual(none);
  });

  it('shows the markdown cheat sheet with every action and its shortcut', () => {
    render(<GuidePage guide={guide} />);
    const section = screen.getByRole('region', { name: 'Texte formatieren (Markdown)' });
    const rows = within(section).getAllByRole('row');
    expect(rows).toHaveLength(MARKDOWN_ACTIONS.length + 1);
    expect(within(section).getByText('Strg + B')).toBeInTheDocument();
    expect(within(section).getByText('Strg + K')).toBeInTheDocument();
  });
});

describe('GuidePage re-render', () => {
  it('keeps the active step in sync when the video emits timeupdate repeatedly', () => {
    const guide = GUIDES.offers;
    render(<GuidePage guide={guide} />);
    const el = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(el, 'currentTime', { configurable: true, value: guide.steps[1].start });

    act(() => {
      fireEvent.timeUpdate(el);
      fireEvent.timeUpdate(el);
    });

    const items = document.querySelectorAll('ol > li');
    expect(items[1]).toHaveClass('border-kf-accent');
    expect(items[0]).not.toHaveClass('border-kf-accent');
  });
});
