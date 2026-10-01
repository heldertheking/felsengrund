import { renderEmailLayout } from './layout';
import { emailTheme } from './theme';
import { escapeHtml, escapeHtmlMultiline } from './escape-html';

export interface NotificationEmailField {
  label: string;
  value: string | undefined;
}

export interface NotificationEmailContent {
  heading: string;
  intro?: string;
  fields: NotificationEmailField[];
  message?: NotificationEmailField;
}

export interface RenderNotificationEmailOptions {
  /** Full-width notice rendered below the header, e.g. a dev-mode redirect banner. */
  bannerHtml?: string;
}

export function renderNotificationEmail(
  content: NotificationEmailContent,
  options: RenderNotificationEmailOptions = {},
): string {
  const { colors, fonts } = emailTheme;

  const introHtml = content.intro
    ? `<p class="font-body" style="margin:0 0 20px; font-family:${fonts.body}; font-size:14px; line-height:22px; mso-line-height-rule:exactly; color:${colors.inkMuted};">${escapeHtml(content.intro)}</p>`
    : '';

  const fieldsHtml = content.fields
    .filter((field): field is { label: string; value: string } => Boolean(field.value))
    .map(
      (field) => `
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid ${colors.edge}; width:150px; vertical-align:top;">
            <span class="font-body" style="font-family:${fonts.body}; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.4px; color:${colors.inkMuted};">${escapeHtml(field.label)}</span>
          </td>
          <td style="padding:10px 0; border-bottom:1px solid ${colors.edge}; vertical-align:top;">
            <span class="font-body" style="font-family:${fonts.body}; font-size:14px; color:${colors.ink};">${escapeHtml(field.value)}</span>
          </td>
        </tr>`,
    )
    .join('');

  const messageHtml = content.message?.value
    ? `
      <div style="margin-top:24px;">
        <div class="font-body" style="font-family:${fonts.body}; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.4px; color:${colors.inkMuted}; margin-bottom:8px;">${escapeHtml(content.message.label)}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${colors.surfaceSunken}; border:1px solid ${colors.edge}; border-radius:8px;" bgcolor="${colors.surfaceSunken}">
          <tr>
            <td style="padding:16px;">
              <p class="font-body" style="margin:0; font-family:${fonts.body}; font-size:14px; line-height:22px; mso-line-height-rule:exactly; color:${colors.ink};">${escapeHtmlMultiline(content.message.value)}</p>
            </td>
          </tr>
        </table>
      </div>`
    : '';

  const bodyHtml = `
    <h1 class="font-heading" style="margin:0 0 12px; font-family:${fonts.heading}; font-size:22px; font-weight:700; color:${colors.ink};">${escapeHtml(content.heading)}</h1>
    ${introHtml}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${fieldsHtml}
    </table>
    ${messageHtml}
  `;

  const previewText = content.message?.value ?? content.intro ?? content.heading;

  return renderEmailLayout({ previewText, bodyHtml, bannerHtml: options.bannerHtml });
}
