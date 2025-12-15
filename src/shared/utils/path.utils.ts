import * as fs from 'fs';
import * as path from 'path';

export function ensureDirectoryExists(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

export function resolveStoragePath(basePath: string, ...segments: string[]): string {
    const resolvedPath = path.join(basePath, ...segments);
    ensureDirectoryExists(resolvedPath);
    return resolvedPath;
}

