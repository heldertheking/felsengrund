/**
 * Glue between `BaseForm.astro` and the API.
 *
 * BaseForm collects the values, validates them and manages the UI state; the *actual request*
 * is sent from here. Every form goes through the same endpoint (`POST /forms`) - the `formId`
 * must be registered in `@felsengrund/types` (Forms.ts). `sendForm` resolves on success and
 * throws on any failure - BaseForm then shows the form's error message and keeps everything
 * the user typed.
 */

import type { FormId, FormPayload } from '@felsengrund/types';
import { API_BASE_URL } from './api';

export type { FormPayload };

export async function sendForm(formId: FormId, payload: FormPayload): Promise<void> {
  const response = await fetch(`${API_BASE_URL ?? ''}/forms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: formId, payload }),
  });
  if (!response.ok) {
    throw new Error(`[forms] Submitting "${formId}" failed with status ${response.status}`);
  }
}
