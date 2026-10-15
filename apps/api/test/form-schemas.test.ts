import { describe, expect, it } from 'vitest';
import { FORM_IDS, formSchemas, type FormId } from '@felsengrund/types/forms';

const valid = (id: FormId, payload: Record<string, string | string[]>) => formSchemas[id].safeParse(payload);

const issuePaths = (id: FormId, payload: Record<string, string | string[]>) => {
  const result = valid(id, payload);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
};

describe('form registry', () => {
  it('lists every schema id', () => {
    expect([...FORM_IDS].sort()).toEqual(['contact', 'counseling', 'feedback', 'prayer']);
  });
});

describe('shared payload checks', () => {
  const contact = { name: 'A', email: 'a@example.com', subject: 'S', message: 'M' };

  it('accepts a valid payload and drops unknown fields', () => {
    const result = valid('contact', { ...contact, extra: 'ignored' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual(contact);
  });

  it('caps values at 5000 characters', () => {
    expect(valid('contact', { ...contact, message: 'x'.repeat(5000) }).success).toBe(true);
    expect(valid('contact', { ...contact, message: 'x'.repeat(5001) }).success).toBe(false);
  });

  it('caps array items at 5000 characters too', () => {
    expect(valid('contact', { ...contact, extra: ['x'.repeat(5001)] }).success).toBe(false);
  });

  it.each(['plain', '@example.com', 'a@', 'a@b', 'a@b.', 'a@.com', 'a b@example.com', 'a@@example.com', 'a@b@c.com'])(
    'rejects the email %j',
    (email) => {
      expect(valid('contact', { ...contact, email }).success).toBe(false);
    },
  );

  it('rejects an email longer than 254 characters', () => {
    expect(valid('contact', { ...contact, email: `${'a'.repeat(250)}@example.com` }).success).toBe(false);
  });

  it('accepts a plain address', () => {
    expect(valid('contact', { ...contact, email: 'first.last+tag@sub.example.ch' }).success).toBe(true);
  });

  it('does not backtrack on a pathological email', () => {
    const started = performance.now();
    valid('contact', { ...contact, email: `${'a.'.repeat(120)}@${'b'.repeat(100)}` });
    expect(performance.now() - started).toBeLessThan(200);
  });
});

describe('contact', () => {
  it.each(['name', 'email', 'subject', 'message'])('requires %s', (field) => {
    const payload: Record<string, string> = { name: 'A', email: 'a@example.com', subject: 'S', message: 'M' };
    delete payload[field];
    expect(valid('contact', payload).success).toBe(false);
  });
});

describe('counseling', () => {
  const base = { name: 'A', subject: 'S', message: 'M' };

  it('requires an email when the contact preference is email', () => {
    expect(issuePaths('counseling', { ...base, contactPreference: 'email' })).toEqual(['email']);
    expect(valid('counseling', { ...base, contactPreference: 'email', email: 'a@example.com' }).success).toBe(true);
  });

  it('requires a phone number when the contact preference is phone', () => {
    expect(issuePaths('counseling', { ...base, contactPreference: 'phone' })).toEqual(['phone']);
    expect(valid('counseling', { ...base, contactPreference: 'phone', phone: '044' }).success).toBe(true);
  });

  it('rejects an unknown contact or counselor preference', () => {
    expect(valid('counseling', { ...base, contactPreference: 'fax', phone: '1' }).success).toBe(false);
    expect(
      valid('counseling', { ...base, contactPreference: 'phone', phone: '1', counselorPreference: 'other' }).success,
    ).toBe(false);
  });

  it('accepts the optional counselor preference', () => {
    for (const counselorPreference of ['none', 'female', 'male']) {
      expect(
        valid('counseling', { ...base, contactPreference: 'phone', phone: '1', counselorPreference }).success,
      ).toBe(true);
    }
  });
});

describe('feedback', () => {
  it('needs only a message when anonymous', () => {
    expect(valid('feedback', { message: 'Super', anonymous: 'on' }).success).toBe(true);
  });

  it('needs a display name and email otherwise', () => {
    expect(issuePaths('feedback', { message: 'Super' }).sort()).toEqual(['displayName', 'email']);
    expect(valid('feedback', { message: 'Super', displayName: 'A', email: 'a@example.com' }).success).toBe(true);
  });

  it('only accepts "on" as the checkbox value', () => {
    expect(valid('feedback', { message: 'Super', anonymous: 'yes' }).success).toBe(false);
  });
});

describe('prayer', () => {
  const base = { topic: 'T', description: 'D' };

  it('needs a display name unless anonymous', () => {
    expect(issuePaths('prayer', base)).toEqual(['displayName']);
    expect(valid('prayer', { ...base, displayName: 'A' }).success).toBe(true);
    expect(valid('prayer', { ...base, anonymous: 'on' }).success).toBe(true);
  });

  it('needs an email when an answer is wanted, even if anonymous', () => {
    expect(issuePaths('prayer', { ...base, anonymous: 'on', answer: 'on' })).toEqual(['email']);
    expect(valid('prayer', { ...base, anonymous: 'on', answer: 'on', email: 'a@example.com' }).success).toBe(true);
  });
});
