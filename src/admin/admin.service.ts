import { Injectable } from '@nestjs/common';
import { FileSystemService } from '../filesystem/filesystem.service';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from '../notification/notification.service';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';

@Injectable()
export class AdminService {
    private baseStoragePath: string;

    constructor(
        private fileSystemService: FileSystemService,
        private configService: ConfigService,
        private notificationService: NotificationService
    ) {
        this.baseStoragePath = this.configService.get<string>('storagePath') ?? './public/users';
    }

    async getStats() {
        return this.fileSystemService.getGlobalStats();
    }

    async createBackup(): Promise<string> {
        const backupDir = path.join(this.baseStoragePath, 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `backup-${timestamp}.zip`);
        const output = fs.createWriteStream(backupPath);
        const archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level.
        });

        return new Promise((resolve, reject) => {
            output.on('close', async () => {
                const adminEmail = this.configService.get<string>('ADMIN_EMAIL') || 'admin@storify.local';
                await this.notificationService.sendEmail(
                    adminEmail,
                    'Backup Created',
                    `Backup saved to ${backupPath}`
                ).catch(e => console.error('Email error', e));
                resolve(backupPath);
            });

            archive.on('error', function (err) {
                reject(err);
            });

            archive.pipe(output);

            const usersDir = path.join(this.baseStoragePath, 'users');
            if (fs.existsSync(usersDir)) {
                archive.directory(usersDir, 'users');
            }

            archive.finalize();
        });
    }
}
