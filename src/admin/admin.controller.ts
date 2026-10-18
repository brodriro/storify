import { formatSize } from '../common/file-types';
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
    const [stats, storage] = await Promise.all([
      this.storageService.getGlobalStats(),
      this.storageService.getStorageSummary(),
    ]);

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
      stats,
      userUsage,
      // The same capacity the browser shows: against TOTAL_STORAGE_GB when it
      // is enforced, otherwise the real volume (no "reference" figure).
      storage: {
        usedLabel: formatSize(storage.usedBytes),
        totalLabel: formatSize(storage.totalBytes),
        freeLabel: formatSize(
          Math.max(0, storage.totalBytes - storage.usedBytes),
        ),
        percent: storage.percent,
      },
      limitEnforced:
        this.configService.get('storageLimitBytes', { infer: true }) !== null,
      totalStorageGb: this.configService.get('totalStorageGb', { infer: true }),
      isAdmin: true,
      totalSizeLabel: formatSize(stats.totalSize),
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
