import { Controller, Get, Query, Request, UseGuards, Render, Post, UploadedFiles, UseInterceptors, Body, StreamableFile, Delete, Res } from '@nestjs/common';
import { createReadStream } from 'fs';
import { Response } from 'express';
import * as path from 'path';
import { FileSystemService } from './filesystem.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FilesInterceptor } from '@nestjs/platform-express';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FileSystemController {
    constructor(private filesystemService: FileSystemService) { }

    @Get('/browser')
    @Render('browser')
    async browser(
        @Request() req,
        @Query('path') currentPath = '',
        @Query('sort') sortBy: 'name' | 'date' = 'name',
        @Query('order') order: 'asc' | 'desc' = 'asc'
    ) {
        if (currentPath && currentPath.includes('..')) currentPath = '';
        currentPath = currentPath || '';

        const userRole = req.user.roles?.includes('admin') ? 'admin' : req.user.roles?.includes('moderator') ? 'moderator' : 'guest';
        const files = await this.filesystemService.listFiles(req.user.username, currentPath, userRole, sortBy, order);

        const parts = currentPath.split('/').filter(p => p);
        const parentPath = parts.slice(0, -1).join('/');

        const breadcrumbs: { name: string, path: string }[] = [];
        let runningPath = '';
        for (const p of parts) {
            runningPath += (runningPath ? '/' : '') + p;
            breadcrumbs.push({ name: p, path: runningPath });
        }

        const filesJson = JSON.stringify(files.map(f => ({
            name: f.name,
            isImage: !!f.isImage,
            isVideo: !!f.isVideo,
            isDir: !!f.isDirectory
        })));

        return {
            files,
            filesJson,
            user: req.user,
            currentPath: currentPath ? currentPath.replace(/^\//, '') : '',
            parentPath,
            breadcrumbs,
            userRole,
            sortBy,
            order
        };
    }

    @Post('upload')
    @UseInterceptors(FilesInterceptor('files', 10, { dest: './temp_uploads' }))
    async uploadFile(@UploadedFiles() files: Array<any>, @Body() body, @Request() req) {
        const relativePath = body.path || '';
        const userRole = req.user.roles?.includes('admin') ? 'admin' : req.user.roles?.includes('moderator') ? 'moderator' : 'guest';
        const uploaded: { original: string, final: string }[] = [];
        for (const file of files) {
            const finalName = await this.filesystemService.handleUpload(req.user.username, file, relativePath, userRole);
            uploaded.push({ original: file.originalname, final: finalName });
        }
        return { success: true, uploaded };
    }

    @Post('mkdir')
    async createFolder(@Body() body, @Request() req) {
        const userRole = req.user.roles?.includes('admin') ? 'admin' : req.user.roles?.includes('moderator') ? 'moderator' : 'guest';
        await this.filesystemService.createFolder(req.user.username, body.path, body.name, userRole);
        return { success: true };
    }

    @Get('download')
    async download(@Query('path') filePath, @Request() req) {
        const userRole = req.user.roles?.includes('admin') ? 'admin' : req.user.roles?.includes('moderator') ? 'moderator' : 'guest';
        const fullPath = await this.filesystemService.downloadFile(req.user.username, filePath, userRole);
        const file = createReadStream(fullPath);
        const filename = path.basename(fullPath);
        return new StreamableFile(file, {
            disposition: `attachment; filename="${filename}"`
        });
    }

    @Get('thumbnail')
    async getThumbnail(@Query('path') filePath, @Request() req, @Res() res: Response) {
        const userRole = req.user.roles?.includes('admin') ? 'admin' : req.user.roles?.includes('moderator') ? 'moderator' : 'guest';
        try {
            const buffer = await this.filesystemService.getThumbnail(req.user.username, filePath, userRole);
            res.set('Content-Type', 'image/jpeg');
            res.send(buffer);
        } catch (error) {
            // Fallback to full image if thumbnail generation fails or type is unsupported
            const fullPath = await this.filesystemService.downloadFile(req.user.username, filePath, userRole);
            res.sendFile(path.resolve(fullPath));
        }
    }

    @Delete('delete')
    async deleteItem(@Body() body, @Request() req) {
        const userRole = req.user.roles?.includes('admin') ? 'admin' : req.user.roles?.includes('moderator') ? 'moderator' : 'guest';
        await this.filesystemService.deleteItem(req.user.username, body.path, userRole);
        return { success: true };
    }

    @Post('rename')
    async renameItem(@Body() body, @Request() req) {
        const userRole = req.user.roles?.includes('admin') ? 'admin' : req.user.roles?.includes('moderator') ? 'moderator' : 'guest';
        await this.filesystemService.renameItem(req.user.username, body.path, body.newName, userRole);
        return { success: true };
    }

    @Post('move')
    async moveItem(@Body() body, @Request() req) {
        const userRole = req.user.roles?.includes('admin') ? 'admin' : req.user.roles?.includes('moderator') ? 'moderator' : 'guest';
        await this.filesystemService.moveItem(req.user.username, body.path, body.destination, userRole);
        return { success: true };
    }

    @Post('bulk-delete')
    async bulkDelete(@Body() body, @Request() req) {
        const userRole = req.user.roles?.includes('admin') ? 'admin' : req.user.roles?.includes('moderator') ? 'moderator' : 'guest';
        const paths: string[] = body.paths || [];
        await Promise.all(paths.map(p => this.filesystemService.deleteItem(req.user.username, p, userRole)));
        return { success: true, count: paths.length };
    }

    @Post('bulk-move')
    async bulkMove(@Body() body, @Request() req) {
        const userRole = req.user.roles?.includes('admin') ? 'admin' : req.user.roles?.includes('moderator') ? 'moderator' : 'guest';
        const paths: string[] = body.paths || [];
        const destination = body.destination;
        await Promise.all(paths.map(p => this.filesystemService.moveItem(req.user.username, p, destination, userRole)));
        return { success: true, count: paths.length };
    }

    @Get('recent')
    async getRecentFiles(@Query('days') days: number = 7, @Request() req) {
        const recentFiles = await this.filesystemService.getRecentFiles(days);
        return { success: true, files: recentFiles };
    }

    @Get('disk-usage')
    async getDiskUsage(@Request() req) {
        const diskUsage = await this.filesystemService.getDiskUsage();
        return { success: true, diskUsage };
    }
}
