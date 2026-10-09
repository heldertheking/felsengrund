import { createLogger } from '@felsengrund/logger';
import { LogLevel, WorkerMailer, type WorkerMailerOptions } from 'worker-mailer';
import type { Env } from '../../types';
import type { FormNotification } from '../form-notifications';
import { EmailBase } from './template/base';
import { renderDevBanner } from './template/dev-banner';
import { FORMS } from './types';

export { FORMS } from './types';
export type { SendOptions } from './types';

// Dedicated sending mailbox, separate from the human-read info@ inbox.
const MAIL_FROM_ADDRESS = 'noreply@kirche-felsengrund.ch';

const MAILBOXES: Record<FORMS, string> = {
  [FORMS.UNSPECIFIED]: 'kontakt@kirche-felsengrund.ch', // Special case to be handled in Subject/Body
  [FORMS.CONTACT]: 'kontakt@kirche-felsengrund.ch',
  [FORMS.PRAYER_REQUEST]: 'gebetsanliegen@kirche-felsengrund.ch',
  [FORMS.CONSOLING]: 'lebensberatung@kirche-felsengrund.ch',
};

export class NotificationService {
  private readonly logger = createLogger('NotificationService');
  private readonly config: WorkerMailerOptions = {
    host: 'mail.webkeeper.ch',
    port: 465,
    secure: true,
    // worker-mailer only tries auth methods listed here - omit this and it fails with
    // "No supported auth method found" even with valid credentials.
    authType: ['plain', 'login'],
    logLevel: LogLevel.INFO,
  };

  async send({ subject, content, mailbox, options }: FormNotification, env: Env): Promise<void> {
    if (mailbox === FORMS.UNSPECIFIED) this.logger.warn('Invocation with unspecified form', { formType: mailbox });

    if (!env.KFA_MAIL_PASSWORD) {
      this.logger.error('KFA_MAIL_PASSWORD is not set - cannot authenticate with the SMTP server', {
        environment: env.ENVIRONMENT,
      });
      throw new Error('Mail credentials are not configured.');
    }

    const isProduction = env.ENVIRONMENT === 'production';
    const originalRecipient = MAILBOXES[mailbox];
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

    const builder = EmailBase.newBuilder().setContent(content);
    if (!isProduction) {
      this.logger.info('Non-production environment - redirecting notification email', {
        environment: env.ENVIRONMENT,
        originalRecipient,
        redirectedTo: to,
      });
      builder.setBanner(renderDevBanner(env.ENVIRONMENT, originalRecipient));
    }

    await WorkerMailer.send(
      { ...this.config, credentials: { username: MAIL_FROM_ADDRESS, password: env.KFA_MAIL_PASSWORD } },
      {
        from: { name: 'Kirche Felsengrund', email: MAIL_FROM_ADDRESS },
        to,
        subject: isProduction ? subject : `[${env.ENVIRONMENT}] ${subject}`,
        html: builder.build(),
        reply: options?.replyTo,
      },
    );
  }
}
