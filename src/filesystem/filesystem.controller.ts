import { Controller, Get, Query, Request, UseGuards, Render, Post, UploadedFiles, UseInterceptors, Body, StreamableFile, Delete } from '@nestjs/common';
import { createReadStream } from 'fs';
import { FileSystemService } from './filesystem.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FilesInterceptor } from '@nestjs/platform-express';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FileSystemController {
    constructor(private filesystemService: FileSystemService) { }

    @Get('browser')
    @Render('browser')
    async browser(@Request() req, @Query('path') currentPath = '') {
        if (currentPath && currentPath.includes('..')) currentPath = '';
        currentPath = currentPath || '';

        const files = await this.filesystemService.listFiles(req.user.username, currentPath);

        const parts = currentPath.split('/').filter(p => p);
        parts.pop();
        const parentPath = parts.join('/');

        return {
            files,
            user: req.user,
            currentPath: currentPath ? currentPath.replace(/^\//, '') : '',
            parentPath
        };
    }

    @Post('upload')
    @UseInterceptors(FilesInterceptor('files', 10, { dest: './temp_uploads' }))
    async uploadFile(@UploadedFiles() files: Array<any>, @Body() body, @Request() req) {
        const relativePath = body.path || '';
        for (const file of files) {
            await this.filesystemService.handleUpload(req.user.username, file, relativePath);
        }
        return { success: true };
    }

    @Post('mkdir')
    async createFolder(@Body() body, @Request() req) {
        await this.filesystemService.createFolder(req.user.username, body.path, body.name);
        return { success: true };
    }

    @Get('download')
    async download(@Query('path') filePath, @Request() req) {
        const fullPath = await this.filesystemService.downloadFile(req.user.username, filePath);
        const file = createReadStream(fullPath);
        return new StreamableFile(file);
    }

    @Delete('delete')
    async deleteItem(@Body() body, @Request() req) {
        await this.filesystemService.deleteItem(req.user.username, body.path);
        return { success: true };
    }

    @Post('rename')
    async renameItem(@Body() body, @Request() req) {
        await this.filesystemService.renameItem(req.user.username, body.path, body.newName);
        return { success: true };
    }
}
