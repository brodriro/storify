import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { FileSystemService } from '../filesystem/filesystem.service';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from '../notification/notification.service';
import * as fs from 'fs';
import * as path from 'path';
import { ensureDirectoryExists, resolveStoragePath } from '../shared/utils/path.utils';
import archiver from 'archiver';

@Injectable()
export class AdminService {
    private baseStoragePath: string;
    private backupDir: string;
    private isBackupRunning = false;
    private lastBackupTimestamp: number = 0; // Store timestamp of the last backup

    constructor(
        private fileSystemService: FileSystemService,
        private configService: ConfigService,
        private notificationService: NotificationService
    ) {
        this.baseStoragePath = this.configService.get<string>('STORAGE_PATH') ?? './public_storage';
        this.backupDir = resolveStoragePath(this.baseStoragePath, 'backups');

        // Initialize lastBackupTimestamp from a file if it exists
        const timestampFile = path.join(this.backupDir, 'last_backup_timestamp.json');
        if (fs.existsSync(timestampFile)) {
            try {
                const data = fs.readFileSync(timestampFile, 'utf8');
                this.lastBackupTimestamp = JSON.parse(data).timestamp;
            } catch (e) {
                console.error('Error reading last backup timestamp file', e);
            }
        }
    }

    private async saveLastBackupTimestamp(timestamp: number) {
        this.lastBackupTimestamp = timestamp;
        const timestampFile = path.join(this.backupDir, 'last_backup_timestamp.json');
        try {
            await fs.promises.writeFile(timestampFile, JSON.stringify({ timestamp }), 'utf8');
        } catch (e) {
            console.error('Error writing last backup timestamp file', e);
        }
    }

    async getStats() {
        return this.fileSystemService.getGlobalStats();
    }

    /**
     * Triggers the creation of a backup in the background.
     * Returns true if the backup has started, or false if one is already running.
     */
    async createBackup(isIncremental: boolean = false): Promise<boolean> {
        if (this.isBackupRunning) {
            return false;
        }

        this.isBackupRunning = true;

        ensureDirectoryExists(this.backupDir);

        const timestamp = new Date().getTime();
        const backupFileName = isIncremental ? `incremental_backup-${timestamp}.zip` : `full_backup-${timestamp}.zip`;
        const backupPath = path.join(this.backupDir, backupFileName);
        const output = fs.createWriteStream(backupPath);
        const archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level.
        });

        output.on('close', async () => {
            try {
                await this.saveLastBackupTimestamp(timestamp); // Save timestamp after successful backup
                const adminEmail = this.configService.get<string>('ADMIN_EMAIL') || 'admin@storify.local';
                await this.notificationService.sendEmail(
                    adminEmail,
                    isIncremental ? 'Incremental Backup Created' : 'Full Backup Created',
                    `Backup saved to ${backupPath}`
                );
            } catch (e) {
                console.error('Email or timestamp save error', e);
            } finally {
                this.isBackupRunning = false;
            }
        });

        archive.on('error', (err) => {
            console.error('Backup archive error', err);
            this.isBackupRunning = false;
        });

        archive.pipe(output);

        const usersDir = path.join(this.baseStoragePath, 'users');

        if (isIncremental && this.lastBackupTimestamp > 0) {
            // Add only modified or new files since last backup
            const filesToArchive: { path: string, name: string }[] = [];

            const collectFiles = async (currentPath: string, relativeArcPath: string) => {
                const items = await fs.promises.readdir(currentPath, { withFileTypes: true });

                for (const item of items) {
                    const fullPath = path.join(currentPath, item.name);
                    const itemRelativeArcPath = path.join(relativeArcPath, item.name);
                    if (item.isDirectory()) {
                        await collectFiles(fullPath, itemRelativeArcPath);
                    } else {
                        const stats = fs.statSync(fullPath);
                        if (stats.mtimeMs > this.lastBackupTimestamp) {
                            filesToArchive.push({ path: fullPath, name: itemRelativeArcPath });
                        }
                    }
                }
            };

            if (fs.existsSync(usersDir)) {
                await collectFiles(usersDir, 'users');
            }

            for (const file of filesToArchive) {
                archive.file(file.path, { name: file.name });
            }
        } else {
            // Full backup: remove previous backups and add entire users directory
            const existing = fs.readdirSync(this.backupDir)
                .filter(name => name.toLowerCase().endsWith('.zip'));
            for (const file of existing) {
                try {
                    fs.unlinkSync(path.join(this.backupDir, file));
                } catch (e) {
                    console.error('Error deleting old backup', e);
                }
            }
            if (fs.existsSync(usersDir)) {
                archive.directory(usersDir, 'users');
            }
        }

        archive.finalize();
        return true;
    }

    getLatestBackupPath(): string | null {
        if (!fs.existsSync(this.backupDir)) {
            return null;
        }

        const files = fs.readdirSync(this.backupDir)
            .filter(name => name.toLowerCase().endsWith('.zip'))
            .sort((a, b) => {
                const aTimestamp = parseInt(a.match(/\d+/)?.[0] || '0');
                const bTimestamp = parseInt(b.match(/\d+/)?.[0] || '0');
                return bTimestamp - aTimestamp; // Newest first
            });

        if (files.length === 0) {
            return null;
        }

        return path.join(this.backupDir, files[0]);
    }

    isBackupInProgress(): boolean {
        return this.isBackupRunning;
    }

    getLastBackupTimestamp(): number {
        return this.lastBackupTimestamp;
    }
}
