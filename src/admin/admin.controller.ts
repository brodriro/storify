import { formatSize } from '../common/file-types';
import { formatDateTime, usageLevel } from '../files/browser-view';
import { t } from '../i18n';
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Render,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'fs';
import * as path from 'path';
import { BackupService } from '../backup/backup.service';
import { CreateBackupDto, DownloadBackupQueryDto } from './admin.dto';
import { StorageService } from '../storage/storage.service';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import type { AppConfig } from '../config/configuration';

/** Backups listed on the dashboard, newest first. */
const BACKUP_HISTORY = 10;

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(
    private readonly storageService: StorageService,
    private readonly backupService: BackupService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  @Get('dashboard')
  @Render('dashboard')
  async dashboard(@CurrentUser() user: AuthUser) {
    // The meter is the browser's: against TOTAL_STORAGE_GB when enforced,
    // otherwise the real volume. No made-up reference capacity.
    const [stats, storage, backups] = await Promise.all([
      this.storageService.getGlobalStats(),
      this.storageService.getStorageSummary(),
      this.backupService.list(),
    ]);
    const limitBytes = this.configService.get('storageLimitBytes', {
      infer: true,
    });

    // Same adaptive units as the browser (a 2 KB total used to read "0 MB").
    const userUsage = Object.fromEntries(
      Object.entries(stats.userUsage).map(([key, bytes]) => [
        key,
        formatSize(bytes),
      ]),
    );

    return {
      pageTitle: t('dashboard.title'),
      user,
      userRole: user.role,
      section: 'admin',
      stats,
      userUsage,
      totalSizeLabel: formatSize(stats.totalSize),
      limitEnforced: limitBytes !== null,
      storage: {
        usedLabel: formatSize(storage.usedBytes),
        totalLabel: formatSize(storage.totalBytes),
        freeLabel: formatSize(
          Math.max(0, storage.totalBytes - storage.usedBytes),
        ),
        percent: storage.percent,
        level: usageLevel(storage.percent),
      },
      backupRunning: this.backupService.isRunning(),
      backups: backups.slice(0, BACKUP_HISTORY).map((b) => ({
        name: b.name,
        isFull: b.kind === 'full',
        createdIso: new Date(b.createdAt).toISOString(),
        createdLabel: formatDateTime(new Date(b.createdAt)),
        sizeLabel: formatSize(b.sizeBytes),
        fileCount: b.fileCount,
        downloadUrl: `/admin/backup/download?name=${encodeURIComponent(b.name)}`,
      })),
      backupsHidden: Math.max(0, backups.length - BACKUP_HISTORY),
    };
  }

  @Post('backup')
  async createBackup(@Body() body: CreateBackupDto) {
    const started = await this.backupService.start(
      body.isIncremental ? 'incremental' : 'full',
    );
    return { success: started, inProgress: !started };
  }

  @Get('backup/list')
  async listBackups() {
    return { backups: await this.backupService.list() };
  }

  @Get('backup/last-timestamp')
  async getLastBackupTimestamp() {
    return { timestamp: await this.backupService.lastBackupTimestamp() };
  }

  @Get('backup/in-progress')
  isBackupInProgress() {
    return { inProgress: this.backupService.isRunning() };
  }

  /** Newest full backup by default, or a specific one from the list. */
  @Get('backup/download')
  async downloadBackup(@Query() { name }: DownloadBackupQueryDto) {
    const zip = await this.backupService.zipPath(name || undefined);
    return new StreamableFile(createReadStream(zip), {
      type: 'application/zip',
      disposition: `attachment; filename="${path.basename(zip)}"`,
    });
  }
}
