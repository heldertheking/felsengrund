import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkerMailer } from 'worker-mailer';
import { call, postJson } from './helpers';

// No real SMTP: the mailer is replaced for this whole file.
vi.mock('worker-mailer', () => ({
  LogLevel: { INFO: 1 },
  WorkerMailer: { send: vi.fn(async () => undefined) },
}));

const send = vi.mocked(WorkerMailer.send);

const contact = { name: 'Anna Muster', email: 'anna@example.com', subject: 'Hallo', message: 'Eine Frage' };

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue(undefined);
});

describe('POST /forms', () => {
  it('rejects an unknown form id with 400', async () => {
    const res = await postJson('/forms', { id: 'newsletter', payload: contact });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ status: 'error', type: 'validation' });
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing id', { payload: contact }],
    ['a missing payload', { id: 'contact' }],
    ['a non-object payload', { id: 'contact', payload: 'nope' }],
    ['a payload with a nested object', { id: 'contact', payload: { name: { a: 1 } } }],
    ['a payload with a number', { id: 'contact', payload: { name: 5 } }],
  ])('rejects %s with 400', async (_label, body) => {
    const res = await postJson('/forms', body);
    expect(res.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects a body that is not JSON', async () => {
    const res = await call('/forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });
    expect(res.status).toBe(400);
    // The API error shape with Hono's fixed text, no internal detail.
    expect(await res.json()).toEqual({ status: 'error', message: 'Malformed JSON in request body' });
    expect(send).not.toHaveBeenCalled();
  });

  it('returns 400 with a validation error when required fields are missing', async () => {
    const res = await postJson('/forms', { id: 'contact', payload: { name: 'Anna' } });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { status: string; type: string; message: string; meta: { submittedAt: string } };
    expect(body).toMatchObject({ status: 'error', type: 'validation', message: 'Fehlende oder ungültige Angaben.' });
    expect(Number.isNaN(Date.parse(body.meta.submittedAt))).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid email address', async () => {
    const res = await postJson('/forms', { id: 'contact', payload: { ...contact, email: 'not-an-email' } });
    expect(res.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it('sends the notification and answers { ok: true } on success', async () => {
    const res = await postJson('/forms', { id: 'contact', payload: contact });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    expect(send).toHaveBeenCalledTimes(1);
    const [options, email] = send.mock.calls[0];
    expect(options.credentials).toEqual({ username: 'noreply@kirche-felsengrund.ch', password: 'test-mail-password' });
    expect(email).toMatchObject({
      to: 'dev-inbox@example.test', // redirected outside production
      subject: '[local] Kontaktformular: Hallo',
      reply: { name: 'Anna Muster', email: 'anna@example.com' },
    });
    expect((email as { html: string }).html).toContain('Eine Frage');
  });

  it('sends to the real mailbox in production, without the dev subject prefix or banner', async () => {
    const res = await postJson('/forms', { id: 'contact', payload: contact }, { ENVIRONMENT: 'production' });
    expect(res.status).toBe(200);
    const [, email] = send.mock.calls[0];
    expect(email).toMatchObject({ to: 'kontakt@kirche-felsengrund.ch', subject: 'Kontaktformular: Hallo' });
    expect((email as { html: string }).html).not.toContain('Testumgebung');
  });

  it('accepts every registered form with a valid payload', async () => {
    const payloads = {
      counseling: {
        name: 'A',
        subject: 'S',
        message: 'M',
        contactPreference: 'phone',
        phone: '044 000 00 00',
      },
      feedback: { message: 'Super', anonymous: 'on' },
      prayer: { topic: 'Dank', description: 'Danke', anonymous: 'on' },
    };
    for (const [id, payload] of Object.entries(payloads)) {
      const res = await postJson('/forms', { id, payload });
      expect(res.status, id).toBe(200);
    }
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('answers 502 when the mailer fails', async () => {
    send.mockRejectedValueOnce(new Error('smtp down'));
    const res = await postJson('/forms', { id: 'contact', payload: contact });
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ status: 'fail', type: 'sending' });
  });

  it('answers 502 when the mail password is not configured', async () => {
    const res = await postJson('/forms', { id: 'contact', payload: contact }, { KFA_MAIL_PASSWORD: undefined });
    expect(res.status).toBe(502);
    expect(send).not.toHaveBeenCalled();
  });

  it('skips sending (but still succeeds) outside production without a dev recipient', async () => {
    const res = await postJson(
      '/forms',
      { id: 'contact', payload: contact },
      { KFA_DEV_NOTIFICATION_RECIPIENT: undefined },
    );
    expect(res.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });
});
