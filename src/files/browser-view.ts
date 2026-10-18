import type { FileEntry } from '../storage/storage.service';

export type BrowserView = 'list' | 'grid';
export type SortKey = 'name' | 'date' | 'size';
export type SortOrder = 'asc' | 'desc';

/** The fixed size scale runs from 1 B to 1 TB in decades (0..12). */
export const SIZE_SCALE_MAX = 12;

/**
 * Datasheet "part number" for an entry: DIR for folders, otherwise the
 * extension in capitals (at most 4 characters), or a dash without one.
 */
export function typeCode(entry: Pick<FileEntry, 'isDirectory' | 'extension'>) {
  if (entry.isDirectory) return 'DIR';
  const ext = entry.extension.replace(/^\./, '').toUpperCase();
  return ext ? ext.slice(0, 4) : '—';
}

/** Position on the fixed logarithmic size scale, rounded to one decimal. */
export function sizeScale(bytes: number): number {
  if (bytes <= 1) return 0;
  return Math.min(SIZE_SCALE_MAX, Math.round(Math.log10(bytes) * 10) / 10);
}

const BYTES = new Intl.NumberFormat('es-ES', { useGrouping: true });

/** Exact byte count with thousands separators ("1.048.576"). */
export function formatBytes(bytes: number): string {
  return BYTES.format(bytes);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-17 15:42": sortable, unambiguous, the datasheet's date style. */
export function formatDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "2026-10-17": the revision date in the masthead. */
export function formatDate(date: Date): string {
  return formatDateTime(date).slice(0, 10);
}

/**
 * Column headers for the list view: clicking the active column flips its
 * order, another column starts ascending (names) or descending (date, size:
 * newest and largest first, the usual question).
 */
export function sortColumns(
  active: SortKey,
  order: SortOrder,
  urlFor: (sort: SortKey, order: SortOrder) => string,
) {
  return (['name', 'size', 'date'] as const).map((key) => {
    const isActive = key === active;
    const next: SortOrder = isActive
      ? order === 'asc'
        ? 'desc'
        : 'asc'
      : key === 'name'
        ? 'asc'
        : 'desc';
    return {
      key,
      url: urlFor(key, next),
      ariaSort: isActive
        ? order === 'asc'
          ? 'ascending'
          : 'descending'
        : 'none',
      isActive,
      isDesc: isActive && order === 'desc',
    };
  });
}
