import { describe, expect, it } from 'vitest';
import { formatTime, GUIDES, GUIDE_ORDER } from '../../src/lib/guides';

describe('formatTime', () => {
  it('formats seconds as m:ss and floors fractions', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(9.9)).toBe('0:09');
    expect(formatTime(65.4)).toBe('1:05');
    expect(formatTime(600)).toBe('10:00');
  });

  it('clamps negative values to zero', () => {
    expect(formatTime(-5)).toBe('0:00');
  });
});

describe('GUIDES', () => {
  it('has one guide per id and lists them all in GUIDE_ORDER', () => {
    expect(Object.keys(GUIDES).sort()).toEqual(['offers', 'podcast']);
    expect([...GUIDE_ORDER].sort()).toEqual(['offers', 'podcast']);
  });

  it.each(GUIDE_ORDER)('guide %s has a video, a poster and steps with ascending start times', (id) => {
    const guide = GUIDES[id];
    expect(guide.title).not.toBe('');
    expect(guide.video.src).toMatch(/\.mp4$/);
    expect(guide.video.poster).toMatch(/\.jpg$/);
    expect(guide.steps.length).toBeGreaterThan(0);

    const starts = guide.steps.map((s) => s.start).filter((s): s is number => s !== undefined);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    for (const step of guide.steps) {
      expect(step.title).not.toBe('');
      expect(step.text).not.toBe('');
    }
  });
});
