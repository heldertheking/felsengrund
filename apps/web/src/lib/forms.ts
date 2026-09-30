/**
 * Glue between `BaseForm.astro` and the API.
 *
 * BaseForm collects the values, validates them and manages the UI state; the *actual request*
 * is sent from here. Register one handler per `formId` in `formHandlers` below.
 * A handler must resolve on success and throw (or reject) on any failure - BaseForm then shows
 * the form's error message and keeps everything the user typed.
 */

/** Field values keyed by `name`. Empty fields are omitted; repeated names become string[]. */
export type FormPayload = Record<string, string | string[]>;

export type FormSubmitHandler = (payload: FormPayload) => Promise<unknown>;

export const formHandlers: Record<string, FormSubmitHandler> = {
  // TODO: connect the API client, one entry per form. Example:
  //
  // import { apiClient } from './api';
  //
  // contact: (p) =>
  //   apiClient.forms.submitContact({
  //     name: p.name as string,
  //     email: p.email as string,
  //     subject: p.subject as string,
  //     message: p.message as string,
  //   }),
};

export async function sendForm(formId: string, payload: FormPayload): Promise<void> {
  const handler = formHandlers[formId];
  if (!handler) {
    throw new Error(`[forms] No API handler registered for form "${formId}" (see src/lib/forms.ts).`);
  }
  await handler(payload);
}
