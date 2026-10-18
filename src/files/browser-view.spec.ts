import {
  formatBytes,
  formatDateTime,
  sizeScale,
  sortColumns,
  typeCode,
} from './browser-view';

describe('browser view helpers (datasheet)', () => {
  it.each([
    [{ isDirectory: true, extension: '' }, 'DIR'],
    [{ isDirectory: false, extension: '.jpg' }, 'JPG'],
    [{ isDirectory: false, extension: '.webmanifest' }, 'WEBM'],
    [{ isDirectory: false, extension: '' }, '—'],
  ])('type code of %j is %s', (entry, code) => {
    expect(typeCode(entry)).toBe(code);
  });

  it('places sizes on a fixed decade scale from 1 B to 1 TB', () => {
    expect(sizeScale(0)).toBe(0);
    expect(sizeScale(1000)).toBe(3);
    expect(sizeScale(5 * 1024 ** 2)).toBe(6.7);
    expect(sizeScale(10 ** 15)).toBe(12);
  });

  it('formats exact bytes and sortable dates', () => {
    expect(formatBytes(1048576)).toBe('1.048.576');
    expect(formatDateTime(new Date(2026, 9, 7, 9, 5))).toBe('2026-10-07 09:05');
  });

  it('builds sortable column headers', () => {
    const cols = sortColumns('name', 'asc', (s, o) => `${s}:${o}`);
    expect(cols.map((c) => [c.key, c.url, c.ariaSort])).toEqual([
      ['name', 'name:desc', 'ascending'],
      ['size', 'size:desc', 'none'],
      ['date', 'date:desc', 'none'],
    ]);
  });
});
