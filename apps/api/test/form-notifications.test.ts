import { describe, expect, it } from 'vitest';
import { FORM_IDS, formSchemas, type FormId } from '@felsengrund/types/forms';
import { buildFormNotification } from '../src/lib/form-notifications';
import { FORMS } from '../src/lib';

describe('buildFormNotification', () => {
  it('contact: targets the contact mailbox and replies to the sender', () => {
    const n = buildFormNotification('contact', {
      name: 'Anna',
      email: 'anna@example.com',
      subject: 'Hallo',
      message: 'Text',
    });
    expect(n.mailbox).toBe(FORMS.CONTACT);
    expect(n.subject).toBe('Kontaktformular: Hallo');
    expect(n.options).toEqual({ replyTo: { name: 'Anna', email: 'anna@example.com' } });
    expect(n.content.heading).toBe('Neue Kontaktanfrage');
    expect(n.content.fields).toEqual([
      { label: 'Name', value: 'Anna' },
      { label: 'E-Mail', value: 'anna@example.com' },
      { label: 'Betreff', value: 'Hallo' },
    ]);
    expect(n.content.message).toEqual({ label: 'Nachricht', value: 'Text' });
  });

  it('counseling: maps the preference labels and only replies when an email was given', () => {
    const byEmail = buildFormNotification('counseling', {
      name: 'Bea',
      subject: 'S',
      message: 'M',
      contactPreference: 'email',
      email: 'bea@example.com',
      counselorPreference: 'female',
    });
    expect(byEmail.mailbox).toBe(FORMS.CONSOLING);
    expect(byEmail.subject).toBe('Lebensberatung: S');
    expect(byEmail.options).toEqual({ replyTo: { name: 'Bea', email: 'bea@example.com' } });
    expect(byEmail.content.fields).toContainEqual({ label: 'Bevorzugte Kontaktart', value: 'E-Mail' });
    expect(byEmail.content.fields).toContainEqual({ label: 'Bevorzugtes Geschlecht', value: 'Weiblich' });

    const byPhone = buildFormNotification('counseling', {
      name: 'Bea',
      subject: 'S',
      message: 'M',
      contactPreference: 'phone',
      phone: '044',
    });
    expect(byPhone.options).toBeUndefined();
    expect(byPhone.content.fields).toContainEqual({ label: 'Bevorzugte Kontaktart', value: 'Telefon' });
    expect(byPhone.content.fields).toContainEqual({ label: 'Telefon', value: '044' });
    expect(byPhone.content.fields).toContainEqual({ label: 'Bevorzugtes Geschlecht', value: undefined });
  });

  it.each([
    ['none', 'Keine Präferenz'],
    ['male', 'Männlich'],
  ] as const)('counseling: labels counselor preference %s', (counselorPreference, label) => {
    const n = buildFormNotification('counseling', {
      name: 'B',
      subject: 'S',
      message: 'M',
      contactPreference: 'phone',
      phone: '1',
      counselorPreference,
    });
    expect(n.content.fields).toContainEqual({ label: 'Bevorzugtes Geschlecht', value: label });
  });

  it('feedback: falls back to the unspecified (general) mailbox', () => {
    const named = buildFormNotification('feedback', { message: 'Gut', displayName: 'Cy', email: 'cy@example.com' });
    expect(named.mailbox).toBe(FORMS.UNSPECIFIED);
    expect(named.subject).toBe('Feedback zur Website');
    expect(named.options).toEqual({ replyTo: { name: 'Cy', email: 'cy@example.com' } });

    const anonymous = buildFormNotification('feedback', { message: 'Gut', anonymous: 'on' });
    expect(anonymous.options).toBeUndefined();
  });

  it('prayer: shows "Anonym" without a name and only replies when an email was given', () => {
    const anonymous = buildFormNotification('prayer', { topic: 'Dank', description: 'D', anonymous: 'on' });
    expect(anonymous.mailbox).toBe(FORMS.PRAYER_REQUEST);
    expect(anonymous.subject).toBe('Gebetsanliegen: Dank');
    expect(anonymous.content.fields).toContainEqual({ label: 'Von', value: 'Anonym' });
    expect(anonymous.options).toBeUndefined();

    const named = buildFormNotification('prayer', {
      topic: 'Dank',
      description: 'D',
      displayName: 'Di',
      answer: 'on',
      email: 'di@example.com',
    });
    expect(named.content.fields).toContainEqual({ label: 'Von', value: 'Di' });
    expect(named.options).toEqual({ replyTo: { name: 'Di', email: 'di@example.com' } });
  });

  it('has a builder for every registered form id', () => {
    const samples: Record<FormId, Record<string, string>> = {
      contact: { name: 'A', email: 'a@example.com', subject: 'S', message: 'M' },
      counseling: { name: 'A', subject: 'S', message: 'M', contactPreference: 'phone', phone: '1' },
      feedback: { message: 'M', anonymous: 'on' },
      prayer: { topic: 'T', description: 'D', anonymous: 'on' },
    };
    for (const id of FORM_IDS) {
      const parsed = formSchemas[id].parse(samples[id]);
      const notification = buildFormNotification(id, parsed as never);
      expect(notification.subject, id).toBeTruthy();
      expect(notification.content.heading, id).toBeTruthy();
    }
  });
});
