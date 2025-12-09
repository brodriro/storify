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
    private backupDir: string;
    private isBackupRunning = false;

    constructor(
        private fileSystemService: FileSystemService,
        private configService: ConfigService,
        private notificationService: NotificationService
    ) {
        this.baseStoragePath = this.configService.get<string>('storagePath') ?? './public/users';
        this.backupDir = path.join(this.baseStoragePath, 'backups');
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    async getStats() {
        return this.fileSystemService.getGlobalStats();
    }

    /**
     * Dispara la creación de un backup en segundo plano.
     * Devuelve true si el backup se ha iniciado, o false si ya hay uno en ejecución.
     */
    createBackup(): boolean {
        if (this.isBackupRunning) {
            return false;
        }

        this.isBackupRunning = true;

        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }

        // Eliminar cualquier backup previo: solo puede existir un ZIP en la carpeta.
        const existing = fs.readdirSync(this.backupDir)
            .filter(name => name.toLowerCase().endsWith('.zip'));
        for (const file of existing) {
            try {
                fs.unlinkSync(path.join(this.backupDir, file));
            } catch (e) {
                console.error('Error deleting old backup', e);
            }
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(this.backupDir, `backup-${timestamp}.zip`);
        const output = fs.createWriteStream(backupPath);
        const archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level.
        });

        output.on('close', async () => {
            try {
                const adminEmail = this.configService.get<string>('ADMIN_EMAIL') || 'admin@storify.local';
                await this.notificationService.sendEmail(
                    adminEmail,
                    'Backup Created',
                    `Backup saved to ${backupPath}`
                );
            } catch (e) {
                console.error('Email error', e);
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
        if (fs.existsSync(usersDir)) {
            archive.directory(usersDir, 'users');
        }

        archive.finalize();

        // No esperamos a que termine; se ejecuta en segundo plano.
        return true;
    }

    getLatestBackupPath(): string | null {
        if (!fs.existsSync(this.backupDir)) {
            return null;
        }

        const files = fs.readdirSync(this.backupDir)
            .filter(name => name.toLowerCase().endsWith('.zip'));

        if (files.length === 0) {
            return null;
        }

        // Solo debería existir uno, pero por seguridad cogemos el primero.
        const latest = files[0];
        return path.join(this.backupDir, latest);
    }

    isBackupInProgress(): boolean {
        return this.isBackupRunning;
    }
}
