import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Render,
  Req,
  Res,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { createReadStream } from 'fs';
import * as path from 'path';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { t } from '../i18n';
import { formatSize } from '../common/file-types';
import { StorageService, UploadedTempFile } from '../storage/storage.service';
import {
  BrowserQueryDto,
  BulkDeleteDto,
  BulkMoveDto,
  FolderQueryDto,
  MkdirDto,
  MoveDto,
  PathBodyDto,
  PathQueryDto,
  RecentQueryDto,
  RenameDto,
  UploadBodyDto,
} from './files.dto';

export const BROWSER_PAGE_SIZE = 200;

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

    const [files, storage] = await Promise.all([
      this.storageService.listFiles(user, currentPath, sortBy, order),
      this.storageService.getStorageSummary(),
    ]);

    // Every link keeps the sort the user chose; folders are real links so
    // they work with the keyboard, middle-click and without JavaScript.
    const browserUrl = (path: string, page = 1) => {
      const params = new URLSearchParams();
      if (path) params.set('path', path);
      if (query.sort) params.set('sort', query.sort);
      if (query.order) params.set('order', query.order);
      if (page > 1) params.set('page', String(page));
      const search = params.toString();
      return search ? `/files/browser?${search}` : '/files/browser';
    };

    const parts = currentPath.split('/').filter((p) => p);
    const parentPath = parts.slice(0, -1).join('/');
    const breadcrumbs = parts.map((name, i) => ({
      name,
      path: parts.slice(0, i + 1).join('/'),
      url: browserUrl(parts.slice(0, i + 1).join('/')),
    }));

    // Rendering is what blocks on big folders (~4 KB of markup per entry), so
    // only one page of entries reaches the template.
    const totalPages = Math.max(1, Math.ceil(files.length / BROWSER_PAGE_SIZE));
    const page = Math.min(query.page ?? 1, totalPages);
    const pageUrl = (n: number) => browserUrl(currentPath, n);
    const pagination = {
      page,
      totalPages,
      totalItems: files.length,
      isPaged: totalPages > 1,
      prevUrl: page > 1 ? pageUrl(page - 1) : null,
      nextUrl: page < totalPages ? pageUrl(page + 1) : null,
    };

    const pageFiles = files.slice(
      (page - 1) * BROWSER_PAGE_SIZE,
      page * BROWSER_PAGE_SIZE,
    );
    const entries = pageFiles.map((f) => {
      const relPath = currentPath ? `${currentPath}/${f.name}` : f.name;
      const query = encodeURIComponent(relPath);
      return {
        ...f,
        path: relPath,
        openUrl: f.isDirectory ? browserUrl(relPath) : null,
        thumbnailUrl: `/files/thumbnail?path=${query}`,
        downloadUrl: `/files/download?path=${query}`,
      };
    });

    // Data for public/js/browser.js, embedded as inert JSON. '<' is escaped so
    // no file name can close the <script> element.
    const clientData = JSON.stringify({
      currentPath,
      parentPath,
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
      pageTitle: currentPath
        ? `${parts[parts.length - 1]} · ${t('browser.title')}`
        : t('browser.title'),
      files: entries,
      clientData,
      user,
      currentPath,
      homeUrl: browserUrl(''),
      parentUrl: currentPath ? browserUrl(parentPath) : null,
      breadcrumbs,
      pagination,
      storage: {
        usedLabel: formatSize(storage.usedBytes),
        totalLabel: formatSize(storage.totalBytes),
        percent: storage.percent,
      },
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

  /** Subfolders of `path` and whether items can be moved there (move picker). */
  @Get('folders')
  listFolders(
    @Query() { path: folderPath }: FolderQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.storageService.listFolders(user, folderPath ?? '');
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
  async getThumbnail(
    @Query() { path: filePath }: PathQueryDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // No fallback to serving the original inline: user-uploaded SVG/HTML on
    // this origin would be a stored XSS vector.
    const thumbnail = await this.storageService.getThumbnail(user, filePath);
    // The ETag changes with the file, so the browser may keep it but must
    // revalidate after max-age; a match costs one stat, not a resize.
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('ETag', thumbnail.etag);
    if (req.headers['if-none-match'] === thumbnail.etag) {
      res.status(304);
      return;
    }
    res.setHeader('Content-Type', 'image/webp');
    return new StreamableFile(createReadStream(thumbnail.path));
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
    @Query() { days, limit }: RecentQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const files = await this.storageService.getRecentFiles(
      user,
      days ?? 7,
      limit,
    );
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
