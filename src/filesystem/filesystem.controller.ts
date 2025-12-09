import { Controller, Get, Query, Request, UseGuards, Render, Post, UploadedFiles, UseInterceptors, Body, StreamableFile, Delete } from '@nestjs/common';
import { createReadStream } from 'fs';
import { FileSystemService } from './filesystem.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FilesInterceptor } from '@nestjs/platform-express';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FileSystemController {
    constructor(private filesystemService: FileSystemService) { }

    @Get('/browser')
    @Render('browser')
    async browser(@Request() req, @Query('path') currentPath = '') {
        if (currentPath && currentPath.includes('..')) currentPath = '';
        currentPath = currentPath || '';

        const isAdmin = req.user.roles?.includes('admin');
        const files = await this.filesystemService.listFiles(req.user.username, currentPath, isAdmin);

        const parts = currentPath.split('/').filter(p => p);
        parts.pop();
        const parentPath = parts.join('/');

        return {
            files,
            user: req.user,
            currentPath: currentPath ? currentPath.replace(/^\//, '') : '',
            parentPath,
            isAdmin
        };
    }

    @Post('upload')
    @UseInterceptors(FilesInterceptor('files', 10, { dest: './temp_uploads' }))
    async uploadFile(@UploadedFiles() files: Array<any>, @Body() body, @Request() req) {
        const relativePath = body.path || '';
        const isAdmin = req.user.roles?.includes('admin');
        for (const file of files) {
            await this.filesystemService.handleUpload(req.user.username, file, relativePath, isAdmin);
        }
        return { success: true };
    }

    @Post('mkdir')
    async createFolder(@Body() body, @Request() req) {
        const isAdmin = req.user.roles?.includes('admin');
        await this.filesystemService.createFolder(req.user.username, body.path, body.name, isAdmin);
        return { success: true };
    }

    @Get('download')
    async download(@Query('path') filePath, @Request() req) {
        const isAdmin = req.user.roles?.includes('admin');
        const fullPath = await this.filesystemService.downloadFile(req.user.username, filePath, isAdmin);
        const file = createReadStream(fullPath);
        return new StreamableFile(file);
    }

    @Delete('delete')
    async deleteItem(@Body() body, @Request() req) {
        const isAdmin = req.user.roles?.includes('admin');
        await this.filesystemService.deleteItem(req.user.username, body.path, isAdmin);
        return { success: true };
    }

    @Post('rename')
    async renameItem(@Body() body, @Request() req) {
        const isAdmin = req.user.roles?.includes('admin');
        await this.filesystemService.renameItem(req.user.username, body.path, body.newName, isAdmin);
        return { success: true };
    }
}
