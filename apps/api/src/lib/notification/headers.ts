import type { SendOptions } from './types';

/**
 * Mail header hygiene. The mail library only encodes non-ASCII header values; plain ASCII text goes into the
 * header block unchanged, so a line break in a value would end the header and start a new one. The form schemas
 * already refuse line breaks in single-line fields; this is the second line of defence, applied right where the
 * values enter the mailer, so no caller can forget it.
 */

const MAX_SUBJECT_LENGTH = 200;
const MAX_DISPLAY_NAME_LENGTH = 100;
/** Characters that would end a quoted display name or start another address. */
const NAME_BREAKING = `"${String.fromCharCode(0x5c)}<>`;
/** Characters that must not appear in an address used in a header (besides whitespace and control characters). */
const ADDRESS_BREAKING = `${NAME_BREAKING},;:'()[]`;

function isControlOrLineBreak(code: number): boolean {
  return code < 0x20 || code === 0x7f || code === 0x85 || code === 0x2028 || code === 0x2029;
}

/** One-line header text: every control character or line break becomes a space, runs of spaces collapse, length is capped. */
export function sanitizeHeaderText(value: string, maxLength = MAX_SUBJECT_LENGTH): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    out += isControlOrLineBreak(code) ? ' ' : value[i];
  }
  return out.split(' ').filter(Boolean).join(' ').slice(0, maxLength);
}

/** A display name for a quoted `"Name" <address>` header: one line, without quotes, backslashes or angle brackets. */
export function sanitizeDisplayName(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let stripped = '';
  for (const char of value) if (!NAME_BREAKING.includes(char)) stripped += char;
  return sanitizeHeaderText(stripped, MAX_DISPLAY_NAME_LENGTH) || undefined;
}

/** A plain `local@domain` address, or `undefined` when it contains anything that could break a header. */
export function sanitizeAddress(value: string): string | undefined {
  const at = value.indexOf('@');
  if (at < 1 || at !== value.lastIndexOf('@') || at === value.length - 1) return undefined;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (isControlOrLineBreak(code) || code === 0x20 || ADDRESS_BREAKING.includes(value[i])) return undefined;
  }
  return value;
}

/** Reply-To with a sanitised name and address; an address that cannot be made safe drops the header entirely. */
export function sanitizeReplyTo(replyTo: SendOptions['replyTo']): { name?: string; email: string } | undefined {
  if (!replyTo) return undefined;
  const raw = typeof replyTo === 'string' ? { email: replyTo } : replyTo;
  const email = sanitizeAddress(raw.email);
  if (!email) return undefined;
  const name = sanitizeDisplayName(raw.name);
  return name ? { name, email } : { email };
}
