import {
  Controller,
  Get,
  Post,
  UseGuards,
  Render,
  StreamableFile,
  NotFoundException,
  Body,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'fs';
import { AdminService } from './admin.service';
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
    private readonly adminService: AdminService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  @Get('dashboard')
  @Render('dashboard')
  async dashboard(@CurrentUser() user: AuthUser) {
    const stats = await this.adminService.getStats();
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
    const started = await this.adminService.createBackup(
      isIncremental === true || isIncremental === 'true',
    );
    if (!started) {
      return { success: false, inProgress: true };
    }
    return { success: true, inProgress: false };
  }

  @Get('backup/last-timestamp')
  getLastBackupTimestamp() {
    return { timestamp: this.adminService.getLastBackupTimestamp() };
  }

  @Get('backup/in-progress')
  isBackupInProgress() {
    return { inProgress: this.adminService.isBackupInProgress() };
  }

  @Get('backup/download')
  async downloadBackup() {
    const backupPath = this.adminService.getLatestBackupPath();
    if (!backupPath) {
      throw new NotFoundException('No backup available');
    }
    const file = createReadStream(backupPath);
    return new StreamableFile(file);
  }
}
