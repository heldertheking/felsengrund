import type { FormId, FormInputs } from '@felsengrund/types';
import { FORMS, type SendOptions } from './notification';
import type { NotificationEmailContent } from './notification/email/notification-email';

/**
 * Translation layer: general form input -> notification email.
 * The mail system only knows subjects, content and mailboxes, so the mapping lives here and
 * can be swapped out when the mails get reworked. Every form id in `FormInputs` needs an entry.
 */
export interface FormNotification {
  subject: string;
  content: NotificationEmailContent;
  mailbox: FORMS;
  options?: SendOptions;
}

type NotificationBuilders = { [K in FormId]: (input: FormInputs[K]) => FormNotification };

const CONTACT_METHOD_LABELS = { email: 'E-Mail', phone: 'Telefon' };
const COUNSELOR_LABELS = { none: 'Keine Präferenz', female: 'Weiblich', male: 'Männlich' };

const formNotifications: NotificationBuilders = {
  contact: (input) => ({
    subject: `Kontaktformular: ${input.subject}`,
    content: {
      heading: 'Neue Kontaktanfrage',
      intro: 'Über das Kontaktformular auf der Website wurde eine neue Anfrage gestellt.',
      fields: [
        { label: 'Name', value: input.name },
        { label: 'E-Mail', value: input.email },
        { label: 'Betreff', value: input.subject },
      ],
      message: { label: 'Nachricht', value: input.message },
    },
    mailbox: FORMS.CONTACT,
    options: { replyTo: { name: input.name, email: input.email } },
  }),

  counseling: (input) => ({
    subject: `Lebensberatung: ${input.subject}`,
    content: {
      heading: 'Neue Anfrage für Lebensberatung',
      intro: 'Über das Formular auf der Website wurde eine neue Anfrage für eine Lebensberatung gestellt.',
      fields: [
        { label: 'Name', value: input.name },
        { label: 'Bevorzugte Kontaktart', value: CONTACT_METHOD_LABELS[input.contactPreference] },
        { label: 'E-Mail', value: input.email },
        { label: 'Telefon', value: input.phone },
        {
          label: 'Bevorzugtes Geschlecht',
          value: input.counselorPreference && COUNSELOR_LABELS[input.counselorPreference],
        },
        { label: 'Betreff', value: input.subject },
      ],
      message: { label: 'Nachricht', value: input.message },
    },
    mailbox: FORMS.CONSOLING,
    options: input.email ? { replyTo: { name: input.name, email: input.email } } : undefined,
  }),

  feedback: (input) => ({
    subject: 'Feedback zur Website',
    content: {
      heading: 'Neues Feedback',
      intro: 'Über das Feedback-Formular auf der Website wurde eine neue Rückmeldung eingereicht.',
      fields: [
        { label: 'Name', value: input.displayName },
        { label: 'E-Mail', value: input.email },
      ],
      message: { label: 'Feedback', value: input.message },
    },
    // Feedback has no dedicated mailbox - falls back to the general kontakt@ inbox.
    mailbox: FORMS.UNSPECIFIED,
    options: input.email ? { replyTo: { name: input.displayName, email: input.email } } : undefined,
  }),

  prayer: (input) => ({
    subject: `Gebetsanliegen: ${input.topic}`,
    content: {
      heading: 'Neues Gebetsanliegen',
      intro: 'Über das Formular auf der Website wurde ein neues Gebetsanliegen eingereicht.',
      fields: [
        { label: 'Von', value: input.displayName || 'Anonym' },
        { label: 'E-Mail', value: input.email },
        { label: 'Thema', value: input.topic },
      ],
      message: { label: 'Anliegen', value: input.description },
    },
    mailbox: FORMS.PRAYER_REQUEST,
    options: input.email ? { replyTo: { name: input.displayName, email: input.email } } : undefined,
  }),
};

/** `input` is the output of the form's schema in `formSchemas` (`@felsengrund/types/forms`). */
export function buildFormNotification<K extends FormId>(id: K, input: FormInputs[K]): FormNotification {
  return formNotifications[id](input);
}
