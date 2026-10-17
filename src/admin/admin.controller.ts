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
    const stats = await this.storageService.getGlobalStats();
    const totalStorageGb = this.configService.get('totalStorageGb', {
      infer: true,
    });
    const totalBytesLimit = totalStorageGb * 1024 * 1024 * 1024;
    const totalSizeMb = Math.round(stats.totalSize / (1024 * 1024));
    const usagePercent =
      totalBytesLimit > 0
        ? Math.min(100, Math.round((stats.totalSize / totalBytesLimit) * 100))
        : 0;

    const userUsageMb: Record<string, number> = {};
    for (const [key, value] of Object.entries(stats.userUsage)) {
      userUsageMb[key] = Math.round((value as number) / (1024 * 1024));
    }

    return {
      user,
      userRole: user.role,
      stats,
      userUsageMb,
      config: { totalStorageGb },
      isAdmin: true,
      usagePercent,
      totalSizeMb,
    };
  }

  @Post('backup')
  async createBackup(@Body('isIncremental') isIncremental: unknown) {
    const started = await this.backupService.start(
      isIncremental === true || isIncremental === 'true'
        ? 'incremental'
        : 'full',
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
  async downloadBackup(@Query('name') name: unknown) {
    const zip = await this.backupService.zipPath(
      typeof name === 'string' && name ? name : undefined,
    );
    return new StreamableFile(createReadStream(zip), {
      type: 'application/zip',
      disposition: `attachment; filename="${path.basename(zip)}"`,
    });
  }
}
