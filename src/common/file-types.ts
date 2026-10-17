/**
 * File-type knowledge shared by storage, the agent and the classifier.
 * Lookups take a lower-case extension with its dot ('.jpg').
 */

/** Shown as images in the browser (inline preview, thumbnail requested). */
export const IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
  '.heic',
  '.heif',
];

/** Played by the browser's <video> element. */
export const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov'];

/** Raster formats sharp can turn into thumbnails (SVG is excluded on purpose). */
export const THUMBNAIL_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.tiff',
  '.heic',
  '.heif',
  '.bmp',
];

/** Documents DocumentReaderService can extract text from. */
export const TEXT_EXTENSIONS = ['.txt', '.docx', '.pdf'];

const MIME_TYPES: Record<string, string> = {
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.csv': 'text/csv',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx':
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.zip': 'application/zip',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.rar': 'application/vnd.rar',
  '.7z': 'application/x-7z-compressed',
  '.iso': 'application/x-iso9660-image',
  '.ts': 'text/typescript',
  '.py': 'text/x-python',
  '.java': 'text/x-java',
  '.sh': 'application/x-sh',
  '.sql': 'application/sql',
};

export function mimeTypeFor(extension: string): string {
  return MIME_TYPES[extension] ?? 'application/octet-stream';
}

const SIZE_UNITS = ['KB', 'MB', 'GB', 'TB'];

/** 512 -> '512 B', 2048 -> '2 KB', 1536000 -> '1.5 MB'. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  let value = bytes;
  let unit = -1;
  do {
    value /= 1024;
    unit++;
  } while (value >= 1024 && unit < SIZE_UNITS.length - 1);
  const rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  return `${rounded} ${SIZE_UNITS[unit]}`;
}
