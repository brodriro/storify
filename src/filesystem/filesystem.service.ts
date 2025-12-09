import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FileSystemService {
    private baseStoragePath: string;

    constructor(private configService: ConfigService) {
        this.baseStoragePath = this.configService.get<string>('storagePath') ?? './public/users';
        if (!fs.existsSync(this.baseStoragePath)) {
            fs.mkdirSync(this.baseStoragePath, { recursive: true });
        }
    }

    getUserPath(username: string): string {
        const userPath = path.join(this.baseStoragePath, 'users', username);
        if (!fs.existsSync(userPath)) {
            fs.mkdirSync(userPath, { recursive: true });
        }
        return userPath;
    }

    async listFiles(username: string, relativePath: string = '') {
        const root = this.getUserPath(username);
        const target = path.join(root, relativePath);

        // Security check to prevent backtracking
        if (!target.startsWith(root)) {
            throw new Error('Access denied');
        }

        if (!fs.existsSync(target)) return [];

        const items = await fs.promises.readdir(target, { withFileTypes: true });
        return items.map(item => ({
            name: item.name,
            isDirectory: item.isDirectory(),
            size: item.isDirectory() ? 0 : fs.statSync(path.join(target, item.name)).size,
            modifiedAt: fs.statSync(path.join(target, item.name)).mtime,
        }));
    }

    async createFolder(username: string, relativePath: string, folderName: string) {
        const root = this.getUserPath(username);
        const target = path.join(root, relativePath, folderName);
        if (!target.startsWith(root)) throw new Error('Access denied');

        if (!fs.existsSync(target)) {
            await fs.promises.mkdir(target, { recursive: true });
        }
    }

    async handleUpload(username: string, file: any, relativePath: string) {
        // file type is Express.Multer.File but avoiding strict type check for now to bypass lint issues if types are missing
        const root = this.getUserPath(username);
        let targetDir = path.join(root, relativePath);
        if (!targetDir.startsWith(root)) throw new Error('Access denied');

        // Ensure target dir exists
        if (!fs.existsSync(targetDir)) {
            await fs.promises.mkdir(targetDir, { recursive: true });
        }

        let finalName = file.originalname;
        let targetPath = path.join(targetDir, finalName);

        // Handle duplicates
        let counter = 1;
        const ext = path.extname(finalName);
        const name = path.basename(finalName, ext);

        while (fs.existsSync(targetPath)) {
            finalName = `${name}_duplicado${counter > 1 ? counter : ''}${ext}`;
            targetPath = path.join(targetDir, finalName);
            counter++;
        }

        // Move file
        await fs.promises.rename(file.path, targetPath);
        return finalName;
    }
    async downloadFile(username: string, relativePath: string): Promise<string> {
        const root = this.getUserPath(username);
        const target = path.join(root, relativePath);

        if (!target.startsWith(root)) {
            throw new Error('Access denied');
        }

        if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
            throw new Error('File not found');
        }

        return target;
    }

    async deleteItem(username: string, relativePath: string) {
        const root = this.getUserPath(username);
        const target = path.join(root, relativePath);

        if (!target.startsWith(root)) {
            throw new Error('Access denied');
        }

        if (!fs.existsSync(target)) {
            throw new Error('Item not found');
        }

        await fs.promises.rm(target, { recursive: true, force: true });
    }

    async renameItem(username: string, currentPath: string, newName: string) {
        const root = this.getUserPath(username);
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
}
