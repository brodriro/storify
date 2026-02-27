import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    constructor(private configService: ConfigService) { }

    async sendEmail(to: string, subject: string, body: string) {
        // In a real app, this would use nodemailer or an API like SendGrid
        this.logger.log(`[MOCK EMAIL] Sending to: ${to}`);
        this.logger.log(`Subject: ${subject}`);
        this.logger.log(`Body: ${body}`);

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));

        this.logger.log(`[MOCK EMAIL] Sent successfully.`);
    }
}
