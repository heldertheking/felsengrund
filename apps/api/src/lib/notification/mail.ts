import { createLogger } from '@felsengrund/logger';
import { LogLevel, WorkerMailer, WorkerMailerOptions } from 'worker-mailer';
import type { Env } from '../../types';
import { emailTheme } from './email/theme';
import { escapeHtml } from './email/escape-html';
import { renderNotificationEmail, type NotificationEmailContent } from './email/notification-email';

export enum FORMS {
  UNSPECIFIED = 0,
  CONTACT = 1,
  PRAYER_REQUEST = 2,
  CONSOLING = 3,
}

export interface SendOptions {
  /** Let's staff hit "reply" and land directly on the person who submitted the form. */
  replyTo?: string | { name?: string; email: string };
}

// Dedicated sending mailbox, separate from the human-read info@ inbox.
const MAIL_FROM_ADDRESS = 'noreply@kirche-felsengrund.ch';

export class NotificationService {
  private readonly logger = createLogger('NotificationService');
  private readonly config: WorkerMailerOptions;

  constructor() {
    this.config = {
      host: 'mail.webkeeper.ch',
      port: 465,
      secure: true,
      // worker-mailer only tries auth methods listed here - omit this and it fails with
      // "No supported auth method found" even with valid credentials.
      authType: ['plain', 'login'],
      logLevel: LogLevel.INFO,
    };
  }

  async send(
    subject: string,
    content: NotificationEmailContent,
    form: FORMS,
    env: Env,
    options: SendOptions = {},
  ): Promise<void> {
    if (form == FORMS.UNSPECIFIED) this.logger.warn('Invocation with unspecified form', { formType: form });

    if (!env.KFA_MAIL_PASSWORD) {
      this.logger.error('KFA_MAIL_PASSWORD is not set - cannot authenticate with the SMTP server', {
        environment: env.ENVIRONMENT,
      });
      throw new Error('Mail credentials are not configured.');
    }

    const isProduction = env.ENVIRONMENT === 'production';
    const originalRecipient = this.formsToEmail[form];
    // Non-production environments redirect all notification mail to this test inbox.
    const to = isProduction ? originalRecipient : env.KFA_DEV_NOTIFICATION_RECIPIENT;

    if (!to) {
      // Never fall back to the real mailboxes outside production.
      this.logger.warn('KFA_DEV_NOTIFICATION_RECIPIENT is not set - skipping notification email', {
        environment: env.ENVIRONMENT,
        originalRecipient,
      });
      return;
    }

    if (!isProduction) {
      this.logger.info('Non-production environment - redirecting notification email', {
        environment: env.ENVIRONMENT,
        originalRecipient,
        redirectedTo: to,
      });
    }

    const html = renderNotificationEmail(content, {
      bannerHtml: isProduction ? undefined : renderDevBanner(env.ENVIRONMENT, originalRecipient),
    });

    await WorkerMailer.send(
      {
        ...this.config,
        credentials: { username: MAIL_FROM_ADDRESS, password: env.KFA_MAIL_PASSWORD },
      },
      {
        from: { name: 'Kirche Felsengrund', email: MAIL_FROM_ADDRESS },
        to,
        subject: isProduction ? subject : `[${env.ENVIRONMENT}] ${subject}`,
        html,
        reply: options.replyTo,
      },
    );
  }

  private formsToEmail: Record<FORMS, string> = {
    [FORMS.UNSPECIFIED]: 'kontakt@kirche-felsengrund.ch', // Special case to be handled in Subject/Body
    [FORMS.CONTACT]: 'kontakt@kirche-felsengrund.ch',
    [FORMS.PRAYER_REQUEST]: 'gebetsanliegen@kirche-felsengrund.ch',
    [FORMS.CONSOLING]: 'lebensberatung@kirche-felsengrund.ch',
  };
}

function renderDevBanner(environment: Env['ENVIRONMENT'], originalRecipient: string): string {
  const { fonts } = emailTheme;
  return `
    <tr>
      <td style="padding:12px 32px; background-color:#fff3cd; border-bottom:1px solid #f0dca0;" bgcolor="#fff3cd">
        <span class="font-body" style="font-family:${fonts.body}; font-size:12px; line-height:18px; mso-line-height-rule:exactly; color:#7a5d00;">
          <strong>Testumgebung (${escapeHtml(environment)}):</strong> Diese E-Mail wurde umgeleitet und wäre in Produktion an <strong>${escapeHtml(originalRecipient)}</strong> gegangen.
        </span>
      </td>
    </tr>`;
}
