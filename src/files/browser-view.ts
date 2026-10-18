import type { FileEntry } from '../storage/storage.service';

export type BrowserView = 'list' | 'grid';
export type SortKey = 'name' | 'date' | 'size';
export type SortOrder = 'asc' | 'desc';

/**
 * Short type label for the list's "Tipo" column: DIR for folders, otherwise
 * the extension in capitals (at most 4 characters), or a dash without one.
 */
export function typeCode(entry: Pick<FileEntry, 'isDirectory' | 'extension'>) {
  if (entry.isDirectory) return 'DIR';
  const ext = entry.extension.replace(/^\./, '').toUpperCase();
  return ext ? ext.slice(0, 4) : '—';
}

const BYTES = new Intl.NumberFormat('es-ES', { useGrouping: true });

/** Exact byte count with thousands separators ("1.048.576"). */
export function formatBytes(bytes: number): string {
  return BYTES.format(bytes);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-17 15:42": sortable and unambiguous in a column. */
export function formatDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * How full the storage is, for the meter's colour: from 75 % it warns, from
 * 90 % it is critical (the usual NAS thresholds).
 */
export function usageLevel(percent: number): 'ok' | 'warning' | 'critical' {
  if (percent >= 90) return 'critical';
  if (percent >= 75) return 'warning';
  return 'ok';
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
