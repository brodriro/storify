import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Post,
  Query,
  Render,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'fs';
import * as path from 'path';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StorageService, UploadedTempFile } from '../storage/storage.service';
import {
  BrowserQueryDto,
  BulkDeleteDto,
  BulkMoveDto,
  MkdirDto,
  MoveDto,
  PathBodyDto,
  PathQueryDto,
  RecentQueryDto,
  RenameDto,
  UploadBodyDto,
} from './files.dto';

/** Runs an operation per path and reports partial failures instead of a bare 500. */
async function settleAll(
  list: string[],
  run: (p: string) => Promise<void>,
): Promise<{
  success: boolean;
  count: number;
  failed: { path: string; error: string }[];
}> {
  const results = await Promise.allSettled(list.map((p) => run(p)));
  const failed = results.flatMap((result, i) =>
    result.status === 'rejected'
      ? [
          {
            path: list[i],
            error:
              result.reason instanceof Error
                ? result.reason.message
                : 'Unknown error',
          },
        ]
      : [],
  );
  return {
    success: failed.length === 0,
    count: list.length - failed.length,
    failed,
  };
}

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly storageService: StorageService) {}

  @Get('/browser')
  @Render('browser')
  async browser(
    @CurrentUser() user: AuthUser,
    @Query() query: BrowserQueryDto,
  ) {
    const sortBy = query.sort ?? 'name';
    const order = query.order ?? 'asc';
    const currentPath = (query.path ?? '').replace(/^\/+/, '');

    const files = await this.storageService.listFiles(
      user,
      currentPath,
      sortBy,
      order,
    );

    const parts = currentPath.split('/').filter((p) => p);
    const breadcrumbs = parts.map((name, i) => ({
      name,
      path: parts.slice(0, i + 1).join('/'),
    }));

    const entries = files.map((f) => {
      const relPath = currentPath ? `${currentPath}/${f.name}` : f.name;
      const query = encodeURIComponent(relPath);
      return {
        ...f,
        path: relPath,
        thumbnailUrl: `/files/thumbnail?path=${query}`,
        downloadUrl: `/files/download?path=${query}`,
      };
    });

    // Data for public/js/browser.js, embedded as inert JSON. '<' is escaped so
    // no file name can close the <script> element.
    const clientData = JSON.stringify({
      currentPath,
      parentPath: parts.slice(0, -1).join('/'),
      canWrite: user.role !== 'guest',
      files: entries.map((f) => ({
        name: f.name,
        path: f.path,
        isImage: f.isImage,
        isVideo: f.isVideo,
        isDir: f.isDirectory,
        downloadUrl: f.downloadUrl,
      })),
    }).replace(/</g, '\\u003c');

    return {
      files: entries,
      clientData,
      user,
      currentPath,
      breadcrumbs,
      userRole: user.role,
      canWrite: user.role !== 'guest',
      sortBy,
      order,
    };
  }

  @Post('upload')
  @UseInterceptors(FilesInterceptor('files'))
  async uploadFile(
    @UploadedFiles() files: UploadedTempFile[] = [],
    @Body() body: UploadBodyDto,
    @CurrentUser() user: AuthUser,
  ) {
    const uploaded: { original: string; final: string }[] = [];
    for (const file of files) {
      const finalName = await this.storageService.handleUpload(
        user,
        file,
        body.path ?? '',
      );
      uploaded.push({ original: file.originalname, final: finalName });
    }
    return { success: true, uploaded };
  }

  @Post('mkdir')
  async createFolder(@Body() body: MkdirDto, @CurrentUser() user: AuthUser) {
    await this.storageService.createFolder(user, body.path ?? '', body.name);
    return { success: true };
  }

  @Get('download')
  async download(
    @Query() { path: filePath }: PathQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const fullPath = await this.storageService.downloadFile(user, filePath);
    return new StreamableFile(createReadStream(fullPath), {
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(fullPath))}`,
    });
  }

  @Get('thumbnail')
  @Header('Content-Type', 'image/webp')
  @Header('Cache-Control', 'private, max-age=300')
  async getThumbnail(
    @Query() { path: filePath }: PathQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    // No fallback to serving the original inline: user-uploaded SVG/HTML on
    // this origin would be a stored XSS vector.
    return new StreamableFile(
      await this.storageService.getThumbnail(user, filePath),
    );
  }

  @Delete('delete')
  async deleteItem(@Body() body: PathBodyDto, @CurrentUser() user: AuthUser) {
    await this.storageService.deleteItem(user, body.path);
    return { success: true };
  }

  @Post('rename')
  async renameItem(@Body() body: RenameDto, @CurrentUser() user: AuthUser) {
    await this.storageService.renameItem(user, body.path, body.newName);
    return { success: true };
  }

  @Post('move')
  async moveItem(@Body() body: MoveDto, @CurrentUser() user: AuthUser) {
    await this.storageService.moveItem(user, body.path, body.destination);
    return { success: true };
  }

  @Post('bulk-delete')
  bulkDelete(@Body() body: BulkDeleteDto, @CurrentUser() user: AuthUser) {
    return settleAll(body.paths, (p) =>
      this.storageService.deleteItem(user, p),
    );
  }

  @Post('bulk-move')
  bulkMove(@Body() body: BulkMoveDto, @CurrentUser() user: AuthUser) {
    return settleAll(body.paths, (p) =>
      this.storageService.moveItem(user, p, body.destination),
    );
  }

  @Get('recent')
  async getRecentFiles(
    @Query() { days }: RecentQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const files = await this.storageService.getRecentFiles(user, days ?? 7);
    return { success: true, files };
  }

  @Get('disk-usage')
  async getDiskUsage() {
    return {
      success: true,
      diskUsage: await this.storageService.getDiskUsage(),
    };
  }
}
