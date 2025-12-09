import { Controller, Get, Post, UseGuards, Render, Request, StreamableFile } from '@nestjs/common';
import { createReadStream } from 'fs';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
    constructor(private adminService: AdminService) { }

    @Get('dashboard')
    @Render('dashboard')
    async dashboard(@Request() req) {
        const roles = req.user.roles || [];
        if (!roles.includes('admin')) {
            // Ideally use ExceptionFilter to redirect, but returning error for view
            return { user: req.user, error: 'Access Denied: Admins only' };
        }
        const stats = await this.adminService.getStats();
        return { user: req.user, stats, config: { totalStorageGb: 10 } };
    }

    @Post('backup')
    async createBackup() {
        const backupPath = await this.adminService.createBackup();
        const file = createReadStream(backupPath);
        return new StreamableFile(file);
    }
}
