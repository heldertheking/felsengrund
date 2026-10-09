import { emailTheme, type EmailTheme } from './theme';
import { escapeHtml, escapeHtmlMultiline } from './escape-html';

export interface EmailField {
  label: string;
  value: string | undefined;
}

export interface EmailContent {
  heading: string;
  intro?: string;
  fields?: EmailField[];
  message?: EmailField;
}

/**
 * Table-based, inline-styled layout for cross-client compatibility (Outlook, Gmail, mobile).
 *
 *   EmailBase.newBuilder().setContent({ heading }).setFields(fields).setBanner(html).setTheme(theme).build()
 */
export class EmailBase {
  static newBuilder(): EmailBaseBuilder {
    return new EmailBaseBuilder();
  }
}

class EmailBaseBuilder {
  private content: EmailContent = { heading: '' };
  private fields?: EmailField[];
  private banner = '';
  private theme: EmailTheme = emailTheme;

  setContent(content: EmailContent): this {
    this.content = content;
    return this;
  }

  /** Overrides `content.fields`. Fields without a value are skipped. */
  setFields(fields: EmailField[]): this {
    this.fields = fields;
    return this;
  }

  /** Full-width notice row below the header (e.g. a dev-mode banner). Raw HTML, escape it yourself. */
  setBanner(bannerHtml: string): this {
    this.banner = bannerHtml;
    return this;
  }

  /** Defaults to the Felsengrund theme. */
  setTheme(theme: EmailTheme): this {
    this.theme = theme;
    return this;
  }

  build(): string {
    const { heading, intro, message } = this.content;
    const fields = this.fields ?? this.content.fields ?? [];
    const { colors: c, fonts: f, brand } = this.theme;

    const label = `font-family:${f.body}; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.4px; color:${c.inkMuted};`;
    const text = (color: string) =>
      `margin:0; font-family:${f.body}; font-size:14px; line-height:22px; mso-line-height-rule:exactly; color:${color};`;
    const bg = (color: string) => `background-color:${color};" bgcolor="${color}`;

    const introHtml = intro ? `<p class="font-body" style="${text(c.inkMuted)} margin-bottom:20px;">${escapeHtml(intro)}</p>` : '';

    const fieldsHtml = fields
      .filter((field): field is { label: string; value: string } => Boolean(field.value))
      .map(
        (field) => `
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid ${c.edge}; width:150px; vertical-align:top;">
            <span class="font-body" style="${label}">${escapeHtml(field.label)}</span>
          </td>
          <td style="padding:10px 0; border-bottom:1px solid ${c.edge}; vertical-align:top;">
            <span class="font-body" style="font-family:${f.body}; font-size:14px; color:${c.ink};">${escapeHtml(field.value)}</span>
          </td>
        </tr>`,
      )
      .join('');

    const messageHtml = message?.value
      ? `
      <div style="margin-top:24px;">
        <div class="font-body" style="${label} margin-bottom:8px;">${escapeHtml(message.label)}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${bg(c.surfaceSunken)}; border:1px solid ${c.edge}; border-radius:8px;">
          <tr>
            <td style="padding:16px;">
              <p class="font-body" style="${text(c.ink)}">${escapeHtmlMultiline(message.value)}</p>
            </td>
          </tr>
        </table>
      </div>`
      : '';

    // Hidden preview text shown next to the subject line in the inbox list.
    const previewText = message?.value ?? intro ?? heading;

    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html lang="de" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<!-- Stops iOS Mail / Gmail Android from auto-linking emails/phone numbers in the fields table. -->
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<title>${escapeHtml(brand.name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${f.googleFontsHref}" rel="stylesheet">
<!--[if mso]>
<style type="text/css">
  table { border-collapse: collapse; }
  .font-heading, .font-body { font-family: Arial, sans-serif !important; }
</style>
<![endif]-->
<style>
  body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { border: 0; line-height: 100%; outline: none; text-decoration: none; }
  body { margin: 0; padding: 0; width: 100% !important; background-color: ${c.surfaceSunken}; }
  a { color: ${c.accent}; }
  @media screen and (max-width: 600px) {
    .email-container { width: 100% !important; }
    .email-padding { padding-left: 20px !important; padding-right: 20px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; ${bg(c.surfaceSunken)};">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; opacity:0;">
  ${escapeHtml(previewText)}
  &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${bg(c.surfaceSunken)};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <!--[if mso]>
      <table role="presentation" align="center" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td>
      <![endif]-->
      <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; ${bg(c.surface)}; border:1px solid ${c.edge}; border-radius:12px;">
        <tr>
          <td class="email-padding" style="padding:28px 32px; ${bg(c.surface)}; border-bottom:1px solid ${c.edge}; border-radius:12px 12px 0 0;">
            <span class="font-heading" style="font-family:${f.heading}; font-size:20px; font-weight:700; color:${c.accent}; letter-spacing:0.2px;">${escapeHtml(brand.name)}</span>
            <div class="font-body" style="font-family:${f.body}; font-size:12px; color:${c.inkMuted}; margin-top:2px; mso-line-height-rule:exactly;">${escapeHtml(brand.tagline)}</div>
          </td>
        </tr>
        ${this.banner}
        <tr>
          <td class="email-padding" style="padding:32px;">
            <h1 class="font-heading" style="margin:0 0 12px; font-family:${f.heading}; font-size:22px; font-weight:700; color:${c.ink};">${escapeHtml(heading)}</h1>
            ${introHtml}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${fieldsHtml}
            </table>
            ${messageHtml}
          </td>
        </tr>
        <tr>
          <td class="email-padding" style="padding:20px 32px; ${bg(c.surfaceSunken)}; border-top:1px solid ${c.edge}; border-radius:0 0 12px 12px;">
            <p class="font-body" style="${text(c.inkMuted)} font-size:12px; line-height:18px;">
              Diese Nachricht wurde automatisch über das Formular auf
              <a href="${brand.url}" style="color:${c.accent}; text-decoration:none;">${escapeHtml(brand.url.replace('https://', ''))}</a> versendet.
            </p>
          </td>
        </tr>
      </table>
      <!--[if mso]>
      </td></tr></table>
      <![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
  }
}
