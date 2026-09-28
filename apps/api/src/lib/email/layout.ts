import { emailTheme } from './theme';
import { escapeHtml } from './escape-html';

export interface EmailLayoutOptions {
  /** Hidden preview text shown next to the subject line in the inbox list. */
  previewText: string;
  /** Inner HTML rendered inside the card's content cell. */
  bodyHtml: string;
  /** Optional full-width notice row rendered between the header and the content (e.g. a dev-mode banner). */
  bannerHtml?: string;
}

// Table-based, inline-styled layout so it survives Outlook (Word rendering engine), Gmail
// (strips <style> in some clients, sanitizes <head>), and mobile mail apps alike. Keep it to
// this one shared shell + a per-notification content fragment rather than pulling in a full
// templating engine - the structure here is simple enough not to need one.
export function renderEmailLayout({ previewText, bodyHtml, bannerHtml = '' }: EmailLayoutOptions): string {
  const { colors, fonts, brand } = emailTheme;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html lang="de" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<!-- Stops iOS Mail / Gmail Android from auto-linking the raw email and phone values in the
     fields table with their own blue underlined style, which would clash with the design. -->
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<title>${escapeHtml(brand.name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${fonts.googleFontsHref}" rel="stylesheet">
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
  body { margin: 0; padding: 0; width: 100% !important; background-color: ${colors.surfaceSunken}; }
  a { color: ${colors.accent}; }
  @media screen and (max-width: 600px) {
    .email-container { width: 100% !important; }
    .email-padding { padding-left: 20px !important; padding-right: 20px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:${colors.surfaceSunken};" bgcolor="${colors.surfaceSunken}">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; opacity:0;">
  ${escapeHtml(previewText)}
  &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${colors.surfaceSunken};" bgcolor="${colors.surfaceSunken}">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <!--[if mso]>
      <table role="presentation" align="center" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td>
      <![endif]-->
      <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:${colors.surface}; border:1px solid ${colors.edge}; border-radius:12px;" bgcolor="${colors.surface}">
        <tr>
          <td class="email-padding" style="padding:28px 32px; background-color:${colors.surface}; border-bottom:1px solid ${colors.edge}; border-radius:12px 12px 0 0;" bgcolor="${colors.surface}">
            <span class="font-heading" style="font-family:${fonts.heading}; font-size:20px; font-weight:700; color:${colors.accent}; letter-spacing:0.2px;">${escapeHtml(brand.name)}</span>
            <div class="font-body" style="font-family:${fonts.body}; font-size:12px; color:${colors.inkMuted}; margin-top:2px; mso-line-height-rule:exactly;">${escapeHtml(brand.tagline)}</div>
          </td>
        </tr>
        ${bannerHtml}
        <tr>
          <td class="email-padding" style="padding:32px;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td class="email-padding" style="padding:20px 32px; background-color:${colors.surfaceSunken}; border-top:1px solid ${colors.edge}; border-radius:0 0 12px 12px;" bgcolor="${colors.surfaceSunken}">
            <p class="font-body" style="margin:0; font-family:${fonts.body}; font-size:12px; line-height:18px; mso-line-height-rule:exactly; color:${colors.inkMuted};">
              Diese Nachricht wurde automatisch über das Formular auf
              <a href="${brand.url}" style="color:${colors.accent}; text-decoration:none;">${escapeHtml(brand.url.replace('https://', ''))}</a> versendet.
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
