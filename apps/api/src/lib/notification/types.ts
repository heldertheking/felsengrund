/** Target mailbox for a notification; resolved to an address by the NotificationService. */
export enum FORMS {
  UNSPECIFIED = 0,
  CONTACT = 1,
  PRAYER_REQUEST = 2,
  CONSOLING = 3,
}

export interface SendOptions {
  /** Lets staff hit "reply" and land directly on the person who submitted the form. */
  replyTo?: string | { name?: string; email: string };
}
