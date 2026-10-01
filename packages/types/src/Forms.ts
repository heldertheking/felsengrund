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
 * Every payload additionally gets the shared checks of `formSchema`: values capped at
 * `MAX_LENGTH` characters and any `email` value must be a valid address.
 */
import { z } from 'zod';

/** Raw field values as collected by `BaseForm`: empty fields are omitted, repeated names become string[]. */
export type FormPayload = Record<string, string | string[]>;

/** User-facing (German) message for any failed form validation. */
export const FORM_INVALID_MESSAGE = 'Fehlende oder ungültige Angaben.';

const MAX_LENGTH = 5000;
const MAX_EMAIL_LENGTH = 254;

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
 * ends up in an email, so cap every value's length (array items included) and keep a malformed
 * address out of `replyTo`.
 */
const payloadSchema = z
  .record(z.string(), z.union([z.string().max(MAX_LENGTH), z.array(z.string().max(MAX_LENGTH))]))
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
  name: z.string(),
  email: z.string(),
  subject: z.string(),
  message: z.string(),
});

const counseling = formSchema({
  name: z.string(),
  subject: z.string(),
  message: z.string(),
  contactPreference: z.enum(['email', 'phone']),
  /** Present when `contactPreference` is `email`. */
  email: z.string().optional(),
  /** Present when `contactPreference` is `phone`. */
  phone: z.string().optional(),
  counselorPreference: z.enum(['none', 'female', 'male']).optional(),
}).superRefine((data, ctx) => requireFields(data, [data.contactPreference === 'phone' ? 'phone' : 'email'], ctx));

const feedback = formSchema({
  message: z.string(),
  anonymous: checked,
  /** Present unless `anonymous`. */
  displayName: z.string().optional(),
  email: z.string().optional(),
}).superRefine((data, ctx) => {
  if (!data.anonymous) requireFields(data, ['displayName', 'email'], ctx);
});

const prayer = formSchema({
  topic: z.string(),
  description: z.string(),
  anonymous: checked,
  answer: checked,
  /** Present unless `anonymous`. */
  displayName: z.string().optional(),
  /** Present when `answer` is checked. */
  email: z.string().optional(),
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
