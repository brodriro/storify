import { Controller, Get, Post, UseGuards, Render, Request, StreamableFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'fs';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
    constructor(
        private adminService: AdminService,
        private configService: ConfigService
    ) { }

    @Get('dashboard')
    @Render('dashboard')
    async dashboard(@Request() req) {
        const roles = req.user.roles || [];
        if (!roles.includes('admin')) {
            // Ideally use ExceptionFilter to redirect, but returning error for view
            return { user: req.user, error: 'Access Denied: Admins only' };
        }
        const stats = await this.adminService.getStats();
        const totalStorageGb = this.configService.get<number>('TOTAL_STORAGE_GB') ?? 10;
        const totalBytesLimit = totalStorageGb * 1024 * 1024 * 1024;
        const totalSizeMb = Math.round(stats.totalSize / (1024 * 1024));
        const usagePercent = totalBytesLimit > 0
            ? Math.min(100, Math.round((stats.totalSize / totalBytesLimit) * 100))
            : 0;

        return { user: req.user, stats, config: { totalStorageGb }, isAdmin: true, usagePercent, totalSizeMb };
    }

    @Post('backup')
    async createBackup() {
        const backupPath = await this.adminService.createBackup();
        const file = createReadStream(backupPath);
        return new StreamableFile(file);
    }
}
