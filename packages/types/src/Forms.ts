/**
 * Single registry for every public form, built on zod: the schemas validate on the server and
 * the input types are inferred from them, so there is one source of truth.
 *
 * Runtime code: this module holds zod schemas, which would end up in the web bundle if they were
 * reachable from the `@felsengrund/types` barrel. The barrel therefore only re-exports the TYPES
 * of this file (`export type *`); `apps/api` imports the schemas from `@felsengrund/types/forms`.
 *
 * Adding a form:
 *  1. Add a schema to `formSchemas` (the key is the form id, i.e. `<BaseForm formId="...">`). Start
 *     from `formSchema({ ... })`; the field names are the `name` attributes of the form's fields.
 *     `FormId` and `FormInputs` are derived from it. Conditional rules go in `.superRefine(...)`.
 *  2. Add the matching entry to `formNotifications` in `apps/api/src/lib/form-notifications.ts`
 *     (the compiler points you there).
 *
 * Every payload additionally gets the shared checks of `formSchema`: a bounded shape (field count, name and array
 * sizes), values capped at `MAX_LENGTH` characters and any `email` value must be a valid address. Single-line
 * fields (`singleLine`) cannot contain line breaks or control characters, because their values end up in mail
 * headers; free text (`multiLine`) may contain newlines but no other control characters.
 */
import { z } from 'zod';

/** Raw field values as collected by `BaseForm`: empty fields are omitted, repeated names become string[]. */
export type FormPayload = Record<string, string | string[]>;

/** User-facing (German) message for any failed form validation. */
export const FORM_INVALID_MESSAGE = 'Fehlende oder ungültige Angaben.';

const MAX_LENGTH = 5000;
const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 100;
const MAX_SUBJECT_LENGTH = 200;
const MAX_PHONE_LENGTH = 50;
/** Real forms have a handful of fields; anything far above that is not a form submission. */
const MAX_FIELDS = 30;
const MAX_FIELD_NAME_LENGTH = 64;
const MAX_ARRAY_ITEMS = 20;

/** Control characters and the Unicode line breaks (NEL, LS, PS): none may appear in a single-line value. */
function hasLineBreakOrControl(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f || code === 0x85 || code === 0x2028 || code === 0x2029) return true;
  }
  return false;
}

/** Control characters other than tab, line feed and carriage return (free text may contain those). */
function hasForbiddenControl(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if ((code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0x7f) return true;
  }
  return false;
}

/** A value that ends up in a mail header or a single table cell: bounded, no line breaks or control characters. */
const singleLine = (max: number) =>
  z
    .string()
    .max(max)
    .refine((value) => !hasLineBreakOrControl(value), 'Line breaks and control characters are not allowed');

/** Free text (messages): newlines are fine, other control characters are not. */
const multiLine = z
  .string()
  .max(MAX_LENGTH)
  .refine((value) => !hasForbiddenControl(value), 'Control characters are not allowed');

/** Plain string checks instead of a regex, so a crafted value can't cause catastrophic backtracking. */
function isEmail(value: string): boolean {
  if (value.length > MAX_EMAIL_LENGTH || /\s/.test(value)) return false;
  const at = value.indexOf('@');
  if (at < 1 || at !== value.lastIndexOf('@')) return false;
  const domain = value.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  return dot > 0 && dot < domain.length - 1;
}

/**
 * Checks shared by every form, applied to the raw payload before the per-form shape: everything
 * ends up in an email, so bound the payload's shape, cap every value's length (array items included)
 * and keep a malformed address out of `replyTo`.
 */
const payloadSchema = z
  .record(
    z.string().max(MAX_FIELD_NAME_LENGTH),
    z.union([z.string().max(MAX_LENGTH), z.array(z.string().max(MAX_LENGTH)).max(MAX_ARRAY_ITEMS)]),
  )
  .refine((payload) => Object.keys(payload).length <= MAX_FIELDS)
  .refine((payload) => typeof payload.email !== 'string' || isEmail(payload.email));

/** A form schema: the shared payload checks, then the form's own fields (unknown fields are dropped). */
function formSchema<S extends z.ZodRawShape>(shape: S) {
  // The cast only widens the object's input to the raw payload, which `payloadSchema` has already checked.
  return payloadSchema.pipe(z.object(shape) as z.ZodType<z.output<z.ZodObject<S>>, FormPayload>);
}

/** Adds an issue for every field of `fields` that is absent from `data`. */
function requireFields(data: Record<string, unknown>, fields: string[], ctx: z.RefinementCtx) {
  for (const field of fields) {
    if (data[field] === undefined) ctx.addIssue({ code: 'custom', message: 'Required', path: [field] });
  }
}

/** Checkbox value as submitted by the browser when no explicit `value` is set. */
const checked = z.literal('on').optional();

const contact = formSchema({
  name: singleLine(MAX_NAME_LENGTH),
  email: singleLine(MAX_EMAIL_LENGTH),
  subject: singleLine(MAX_SUBJECT_LENGTH),
  message: multiLine,
});

const counseling = formSchema({
  name: singleLine(MAX_NAME_LENGTH),
  subject: singleLine(MAX_SUBJECT_LENGTH),
  message: multiLine,
  contactPreference: z.enum(['email', 'phone']),
  /** Present when `contactPreference` is `email`. */
  email: singleLine(MAX_EMAIL_LENGTH).optional(),
  /** Present when `contactPreference` is `phone`. */
  phone: singleLine(MAX_PHONE_LENGTH).optional(),
  counselorPreference: z.enum(['none', 'female', 'male']).optional(),
}).superRefine((data, ctx) => requireFields(data, [data.contactPreference === 'phone' ? 'phone' : 'email'], ctx));

const feedback = formSchema({
  message: multiLine,
  anonymous: checked,
  /** Present unless `anonymous`. */
  displayName: singleLine(MAX_NAME_LENGTH).optional(),
  email: singleLine(MAX_EMAIL_LENGTH).optional(),
}).superRefine((data, ctx) => {
  if (!data.anonymous) requireFields(data, ['displayName', 'email'], ctx);
});

const prayer = formSchema({
  topic: singleLine(MAX_SUBJECT_LENGTH),
  description: multiLine,
  anonymous: checked,
  answer: checked,
  /** Present unless `anonymous`. */
  displayName: singleLine(MAX_NAME_LENGTH).optional(),
  /** Present when `answer` is checked. */
  email: singleLine(MAX_EMAIL_LENGTH).optional(),
}).superRefine((data, ctx) => {
  if (!data.anonymous) requireFields(data, ['displayName'], ctx);
  if (data.answer) requireFields(data, ['email'], ctx);
});

/** Form id -> schema. Extend this to register a new form. */
export const formSchemas = { contact, counseling, feedback, prayer };

export type FormId = keyof typeof formSchemas;

/** Form id -> validated input shape, inferred from `formSchemas`. */
export type FormInputs = { [K in FormId]: z.output<(typeof formSchemas)[K]> };

export const FORM_IDS = Object.keys(formSchemas) as [FormId, ...FormId[]];

export interface OkResponse {
  ok: true;
}
