import { strFromU8, unzipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadMdocExport } from '../../src/lib/export';
import { toMdoc } from '../../src/lib/mdoc';

let blobs: Blob[];
let clicked: { download: string; href: string }[];

beforeEach(() => {
  blobs = [];
  clicked = [];
  URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
    blobs.push(blob as Blob);
    return `blob:mock-${blobs.length}`;
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push({ download: this.download, href: this.href });
  });
});

afterEach(() => {
  vi.useRealTimers();
});

async function bytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

describe('downloadMdocExport', () => {
  it('does nothing for an empty selection', () => {
    downloadMdocExport('x', []);
    expect(blobs).toHaveLength(0);
    expect(clicked).toHaveLength(0);
  });

  it('downloads a single entry directly as <slug>.mdoc', async () => {
    downloadMdocExport('angebote-export', [{ slug: 'kinderstunde', data: { title: 'Kinderstunde' }, body: 'Hallo' }]);

    expect(clicked).toEqual([{ download: 'kinderstunde.mdoc', href: 'blob:mock-1' }]);
    expect(blobs[0].type).toBe('text/markdown');
    expect(strFromU8(await bytes(blobs[0]))).toBe(toMdoc({ title: 'Kinderstunde' }, 'Hallo'));
  });

  it('zips several entries into <prefix>-<date>.zip with one .mdoc per slug', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-04T10:00:00Z'));

    downloadMdocExport('podcast-export', [
      { slug: 'folge-1', data: { title: 'Eins' }, body: 'a' },
      { slug: 'folge-2', data: { title: 'Zwei' }, body: 'b' },
    ]);

    expect(clicked[0].download).toBe('podcast-export-2026-03-04.zip');
    expect(blobs[0].type).toBe('application/zip');
    const files = unzipSync(await bytes(blobs[0]));
    expect(Object.keys(files).sort()).toEqual(['folge-1.mdoc', 'folge-2.mdoc']);
    expect(strFromU8(files['folge-2.mdoc'])).toBe(toMdoc({ title: 'Zwei' }, 'b'));
  });

  it('cleans up the temporary link and object URL', () => {
    downloadMdocExport('x', [{ slug: 'a', data: {}, body: '' }]);
    expect(document.querySelector('a[download]')).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-1');
  });
});
