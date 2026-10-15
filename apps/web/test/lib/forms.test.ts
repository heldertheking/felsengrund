import { describe, expect, it, vi } from 'vitest';
import { sendForm } from '../../src/lib/forms';
import { jsonResponse, mockApi } from '../helpers';

describe('sendForm', () => {
  it('POSTs { id, payload } as JSON to /forms on the API origin', async () => {
    const { calls } = mockApi({ 'POST /forms': () => jsonResponse({ ok: true }) });

    await sendForm('contact', { name: 'Anna', topics: ['a', 'b'] });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('http://api.test/forms');
    expect(calls[0].headers.get('Content-Type')).toBe('application/json');
    expect(await calls[0].json()).toEqual({ id: 'contact', payload: { name: 'Anna', topics: ['a', 'b'] } });
  });

  it('throws with the form id and status on a non-2xx response', async () => {
    mockApi({ 'POST /forms': () => jsonResponse({ message: 'nope' }, 422) });
    await expect(sendForm('contact', {})).rejects.toThrow('Submitting "contact" failed with status 422');
  });

  it('propagates network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(sendForm('contact', {})).rejects.toThrow('offline');
  });
});
