import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FileSystemService {
    private baseStoragePath: string;

    constructor(private configService: ConfigService) {
        this.baseStoragePath = this.configService.get<string>('storagePath') ?? './public_storage';

        if (!fs.existsSync(this.baseStoragePath)) {
            fs.mkdirSync(this.baseStoragePath, { recursive: true });
        }
        // Ensure standard "users" subdirectory structure
        const usersDir = path.join(this.baseStoragePath, 'users');
        if (!fs.existsSync(usersDir)) {
            fs.mkdirSync(usersDir, { recursive: true });
        }
    }

    getUserPath(username: string): string {
        const userPath = path.join(this.baseStoragePath, 'users', username);
        if (!fs.existsSync(userPath)) {
            fs.mkdirSync(userPath, { recursive: true });
        }
        return userPath;
    }

    private getUsersRoot(): string {
        const usersRoot = path.join(this.baseStoragePath, 'users');
        if (!fs.existsSync(usersRoot)) {
            fs.mkdirSync(usersRoot, { recursive: true });
        }
        return usersRoot;
    }

    private resolveRoot(username: string, isAdmin: boolean): string {
        // All users (including non-admin) operate logically under the common
        // "users" root. Access to specific user folders is enforced separately.
        if (isAdmin) {
            return this.getUsersRoot();
        }
        return this.getUsersRoot();
    }

    private ensureUserAccess(username: string, relativePath: string, isAdmin: boolean): void {
        if (isAdmin) {
            return;
        }

        if (!relativePath) {
            return;
        }

        const normalized = relativePath.replace(/\\/g, '/');
        const segments = normalized.split('/').filter(Boolean);
        if (segments.length === 0) {
            return;
        }

        // If there is only one segment, we are operating on an item directly under
        // the shared /users root (e.g. "file.txt"). This is allowed for
        // non-admin users as long as they did not navigate into other users'
        // folders.
        if (segments.length === 1) {
            return;
        }

        // When dealing with nested paths, enforce that the first directory
        // segment matches the current username (e.g. "ALICE/..." ).
        const firstSegment = segments[0];
        if (firstSegment !== username) {
            throw new Error('Access denied');
        }
    }

    async listFiles(username: string, relativePath: string = '', isAdmin: boolean = false, sortBy: 'name' | 'date' = 'name', order: 'asc' | 'desc' = 'asc') {
        const root = this.resolveRoot(username, isAdmin);

        // Enforce that non-admin users can only browse inside their own
        // user folder when specifying a relativePath.
        this.ensureUserAccess(username, relativePath, isAdmin);

        const target = path.join(root, relativePath);

        // Security check
        if (!target.startsWith(root)) {
            throw new Error('Access denied');
        }

        if (!fs.existsSync(target)) return [];

        const items = await fs.promises.readdir(target, { withFileTypes: true });
        const mappedItems = items.map(item => {
            const fullItemPath = path.join(target, item.name);
            const ext = item.isDirectory() ? '' : path.extname(item.name).toLowerCase();
            const stats = fs.statSync(fullItemPath);
            const sizeBytes = item.isDirectory() ? 0 : stats.size;
            const sizeMb = item.isDirectory() ? 0 : Math.max(1, Math.round(sizeBytes / (1024 * 1024)));
            return {
                name: item.name,
                isDirectory: item.isDirectory(),
                size: sizeBytes,
                sizeMb,
                modifiedAt: stats.mtime,
                extension: ext,
                isImage: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'].includes(ext),
                isVideo: ['.mp4', '.webm', '.ogg', '.mov'].includes(ext)
            };
        });

        // Filter out other users' folders for non-admin users at root level
        const usersConfig = this.configService.get<any[]>('users') || [];
        const knownUsernames = new Set<string>(usersConfig.map(u => u.username));

        const filteredItems = mappedItems.filter(item => {
            // Admin can see everything
            if (isAdmin) return true;

            // If not at root level, show everything (user is in their own folder tree)
            if (relativePath !== '') return true;

            // At root level: hide directories whose name matches a configured user
            // different from the current user. Directories with names that are not
            // configured usernames are considered global and are visible.
            if (item.isDirectory) {
                if (knownUsernames.has(item.name) && item.name !== username) {
                    return false;
                }
            }

            // Show files and allowed folders
            return true;
        });

        return filteredItems.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;

            let comparison = 0;
            if (sortBy === 'name') {
                comparison = a.name.localeCompare(b.name);
            } else if (sortBy === 'date') {
                comparison = a.modifiedAt.getTime() - b.modifiedAt.getTime();
            }

            return order === 'asc' ? comparison : -comparison;
        });
    }

    async createFolder(username: string, relativePath: string, folderName: string, isAdmin: boolean = false) {
        const root = this.resolveRoot(username, isAdmin);

        // Ensure non-admin users cannot create folders under other users' trees.
        this.ensureUserAccess(username, path.join(relativePath || '', folderName), isAdmin);

        const target = path.join(root, relativePath, folderName);

        if (!target.startsWith(root)) throw new Error('Access denied');

        if (!fs.existsSync(target)) {
            await fs.promises.mkdir(target, { recursive: true });
        }
    }

    async handleUpload(username: string, file: any, relativePath: string, isAdmin: boolean = false) {
        const root = this.resolveRoot(username, isAdmin);

        // Ensure non-admin users cannot upload into other users' folders.
        this.ensureUserAccess(username, relativePath, isAdmin);

        let targetDir = path.join(root, relativePath);

        if (!targetDir.startsWith(root)) throw new Error('Access denied');

        if (!fs.existsSync(targetDir)) {
            await fs.promises.mkdir(targetDir, { recursive: true });
        }

        let finalName = file.originalname;
        let targetPath = path.join(targetDir, finalName);
        let counter = 1;
        const ext = path.extname(finalName);
        const name = path.basename(finalName, ext);

        while (fs.existsSync(targetPath)) {
            finalName = `${name}_duplicado${counter > 1 ? counter : ''}${ext}`;
            targetPath = path.join(targetDir, finalName);
            counter++;
        }

        await fs.promises.rename(file.path, targetPath);
        return finalName;
    }

    async downloadFile(username: string, relativePath: string, isAdmin: boolean = false): Promise<string> {
        const root = this.resolveRoot(username, isAdmin);

        // Ensure non-admin users cannot download from other users' folders.
        this.ensureUserAccess(username, relativePath, isAdmin);

        const target = path.join(root, relativePath);

        if (!target.startsWith(root)) {
            throw new Error('Access denied');
        }

        if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
            throw new Error('File not found');
        }

        return target;
    }

    async deleteItem(username: string, relativePath: string, isAdmin: boolean = false) {
        const root = this.resolveRoot(username, isAdmin);

        // Ensure non-admin users cannot delete items from other users' folders.
        this.ensureUserAccess(username, relativePath, isAdmin);

        const target = path.join(root, relativePath);

        if (!target.startsWith(root)) {
            throw new Error('Access denied');
        }

        if (!fs.existsSync(target)) {
            throw new Error('Item not found');
        }

        await fs.promises.rm(target, { recursive: true, force: true });
    }

    async renameItem(username: string, currentPath: string, newName: string, isAdmin: boolean = false) {
        const root = this.resolveRoot(username, isAdmin);

        // Ensure non-admin users cannot rename items outside their folder.
        this.ensureUserAccess(username, currentPath, isAdmin);

        const oldTarget = path.join(root, currentPath);
        const dir = path.dirname(oldTarget);
        const newTarget = path.join(dir, newName);

        if (!oldTarget.startsWith(root) || !newTarget.startsWith(root)) {
            throw new Error('Access denied');
        }

        if (!fs.existsSync(oldTarget)) {
            throw new Error('Item not found');
        }

        if (fs.existsSync(newTarget)) {
            throw new Error('Target name already exists');
        }

        await fs.promises.rename(oldTarget, newTarget);
    }

    async moveItem(username: string, currentPath: string, destinationPath: string, isAdmin: boolean = false) {
        const root = this.resolveRoot(username, isAdmin);

        // Ensure non-admin users cannot move items between other users' folders
        // or into folders belonging to other users.
        this.ensureUserAccess(username, currentPath, isAdmin);
        this.ensureUserAccess(username, destinationPath, isAdmin);

        const source = path.join(root, currentPath);
        // destinationPath is relative to root. If destinationPath is '..', we handle logical parent in UI or here? 
        // Better to treat destinationPath as the target directory relative to root.

        // If user says "move file.txt to /subfolder", destinationPath is "subfolder"
        const destDir = path.join(root, destinationPath);
        const filename = path.basename(source);
        const finalDest = path.join(destDir, filename);

        if (!source.startsWith(root) || !finalDest.startsWith(root)) {
            throw new Error('Access denied');
        }

        if (!fs.existsSync(source)) {
            throw new Error('Source item not found');
        }

        if (!fs.existsSync(destDir)) {
            throw new Error('Destination folder does not exist');
        }

        if (fs.existsSync(finalDest)) {
            throw new Error('File with same name exists in destination');
        }

        await fs.promises.rename(source, finalDest);
    }
    async getGlobalStats() {
        const root = this.getUsersRoot();
        const stats = {
            totalSize: 0,
            totalFiles: 0,
            fileTypes: {} as Record<string, number>,
            userUsage: {} as Record<string, number>,
        };

        if (!fs.existsSync(root)) return stats;

        const processDir = async (dirPath: string, username?: string) => {
            const items = await fs.promises.readdir(dirPath, { withFileTypes: true });

            for (const item of items) {
                const fullPath = path.join(dirPath, item.name);
                if (item.isDirectory()) {
                    // If we are at the root 'users' dir, the next level is the username
                    const nextUsername = username || (dirPath === root ? item.name : undefined);
                    await processDir(fullPath, nextUsername);
                } else {
                    const size = fs.statSync(fullPath).size;
                    stats.totalSize += size;
                    stats.totalFiles++;

                    const ext = path.extname(item.name).toLowerCase() || 'unknown';
                    stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;

                    if (username) {
                        stats.userUsage[username] = (stats.userUsage[username] || 0) + size;
                    } else {
                        // Archivos que no pertenecen a ningún usuario directo (p.ej. en la raíz compartida)
                        stats.userUsage['OTROS'] = (stats.userUsage['OTROS'] || 0) + size;
                    }
                }
            }
        };

        await processDir(root);
        return stats;
    }

    async getDiskUsage(): Promise<{ totalBytes: number }> {
        const stats = await this.getGlobalStats();
        return { totalBytes: stats.totalSize };
    }

    async getRecentFiles(days: number = 7): Promise<any[]> {
        const root = this.getUsersRoot();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const recentFiles: any[] = [];

        const traverseDirectory = async (dirPath: string) => {
            const items = await fs.promises.readdir(dirPath, { withFileTypes: true });

            for (const item of items) {
                const fullPath = path.join(dirPath, item.name);
                const stats = fs.statSync(fullPath);

                if (stats.isDirectory()) {
                    await traverseDirectory(fullPath);
                } else if (stats.mtime > cutoffDate) {
                    recentFiles.push({
                        name: item.name,
                        path: fullPath,
                        size: stats.size,
                        modifiedAt: stats.mtime,
                        extension: path.extname(item.name).toLowerCase(),
                    });
                }
            }
        };

        if (fs.existsSync(root)) {
            await traverseDirectory(root);
        }

        return recentFiles;
    }
}
