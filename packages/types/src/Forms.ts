/**
 * Single registry for every public form.
 *
 * Adding a form:
 *  1. Add its input shape to `FormInputs` (the key is the form id, i.e. `<BaseForm formId="...">`).
 *  2. Add an entry to `formValidators`: a validator, or `null` if the frontend's validation is enough.
 *  3. Add the matching entry to `formNotifications` in `apps/api/src/lib/form-notifications.ts`
 *     (the compiler points you there).
 *
 * The input field names are the `name` attributes of the form's fields.
 */

/** Raw field values as collected by `BaseForm`: empty fields are omitted, repeated names become string[]. */
export type FormPayload = Record<string, string | string[]>;

/** Checkbox value as submitted by the browser when no explicit `value` is set. */
type Checked = 'on';

export interface ContactInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface CounselingInput {
  name: string;
  subject: string;
  message: string;
  contactPreference: 'email' | 'phone';
  /** Present when `contactPreference` is `email`. */
  email?: string;
  /** Present when `contactPreference` is `phone`. */
  phone?: string;
  counselorPreference?: 'none' | 'female' | 'male';
}

export interface FeedbackInput {
  message: string;
  anonymous?: Checked;
  /** Present unless `anonymous`. */
  displayName?: string;
  email?: string;
}

export interface PrayerRequestInput {
  topic: string;
  description: string;
  anonymous?: Checked;
  answer?: Checked;
  /** Present unless `anonymous`. */
  displayName?: string;
  /** Present when `answer` is checked. */
  email?: string;
}

/** Form id -> input shape. Extend this to register a new form. */
export interface FormInputs {
  contact: ContactInput;
  counseling: CounselingInput;
  feedback: FeedbackInput;
  prayer: PrayerRequestInput;
}

export type FormId = keyof FormInputs;

/** Returns a (German, user-facing) error message, or `null` if the payload is valid. */
export type FormValidator = (payload: FormPayload) => string | null;

const INVALID = 'Fehlende oder ungültige Angaben.';
const MAX_LENGTH = 5000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHECKED = ['on'];

/**
 * Checks that every `required` field is present as a string (the collector omits empty fields) and that `optional` fields, if present,
 * are strings. Returns an error message or `null`.
 */
function checkFields(
  payload: FormPayload,
  required: string[],
  optional: string[] = [],
  oneOf: Record<string, string[]> = {},
): string | null {
  if (required.some((key) => typeof payload[key] !== 'string')) return INVALID;
  if (optional.some((key) => payload[key] !== undefined && typeof payload[key] !== 'string')) return INVALID;
  // Everything ends up in an email: cap lengths, and keep a malformed address out of `replyTo`.
  const tooLong = Object.values(payload).some((v) => [v].flat().some((t) => t.length > MAX_LENGTH));
  if (tooLong) return INVALID;
  if (typeof payload.email === 'string' && !EMAIL_PATTERN.test(payload.email)) return INVALID;
  for (const [key, allowed] of Object.entries(oneOf)) {
    if (payload[key] !== undefined && !allowed.includes(payload[key] as string)) return INVALID;
  }
  return null;
}

/**
 * One entry per form id. `null` = no server-side validation (the frontend already does it).
 * A validator must reject anything the notification builder couldn't handle, since it casts the
 * payload to the form's input type.
 */
export const formValidators: Record<FormId, FormValidator | null> = {
  contact: (p) => checkFields(p, ['name', 'email', 'subject', 'message']),

  counseling: (p) =>
    p.contactPreference !== 'email' && p.contactPreference !== 'phone'
      ? INVALID
      : checkFields(
          p,
          ['name', 'subject', 'message', p.contactPreference === 'phone' ? 'phone' : 'email'],
          ['phone', 'email', 'counselorPreference'],
          { counselorPreference: ['none', 'female', 'male'] },
        ),

  feedback: (p) =>
    checkFields(p, ['message', ...(p.anonymous ? [] : ['displayName', 'email'])], ['anonymous'], {
      anonymous: CHECKED,
    }),

  prayer: (p) =>
    checkFields(
      p,
      ['topic', 'description', ...(p.anonymous ? [] : ['displayName']), ...(p.answer ? ['email'] : [])],
      ['anonymous', 'answer', 'displayName', 'email'],
      { anonymous: CHECKED, answer: CHECKED },
    ),
};

export function isFormId(id: unknown): id is FormId {
  return typeof id === 'string' && Object.hasOwn(formValidators, id);
}

export function validateForm(id: FormId, payload: FormPayload): string | null {
  return formValidators[id]?.(payload) ?? null;
}

export interface OkResponse {
  ok: true;
}

/** Error body returned by every `apps/api` route. */
export interface ErrorResponse {
  status: 'error' | 'fail';
  message: string;
  meta?: Record<string, unknown>;
}
