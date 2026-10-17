import { Injectable, Logger } from '@nestjs/common';

/**
 * Admin notifications. No mail transport is configured yet, so notifications
 * are written to the log (and say so) instead of pretending to send an email.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  sendEmail(to: string, subject: string, body: string): Promise<void> {
    this.logger.log(
      `Notification for ${to} (email delivery not configured): ${subject} - ${body}`,
    );
    return Promise.resolve();
  }
}
