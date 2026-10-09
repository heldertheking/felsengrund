import type { EmailTheme } from './theme';
import { emailTheme } from './theme';
import { escapeHtml } from './escape-html';

/** Notice row for non-production mail that was redirected away from its real mailbox. */
export function renderDevBanner(
  environment: string,
  originalRecipient: string,
  { fonts }: EmailTheme = emailTheme,
): string {
  return `
    <tr>
      <td style="padding:12px 32px; background-color:#fff3cd; border-bottom:1px solid #f0dca0;" bgcolor="#fff3cd">
        <span class="font-body" style="font-family:${fonts.body}; font-size:12px; line-height:18px; mso-line-height-rule:exactly; color:#7a5d00;">
          <strong>Testumgebung (${escapeHtml(environment)}):</strong> Diese E-Mail wurde umgeleitet und wäre in Produktion an <strong>${escapeHtml(originalRecipient)}</strong> gegangen.
        </span>
      </td>
    </tr>`;
}
