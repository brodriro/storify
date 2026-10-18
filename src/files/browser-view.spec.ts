import {
  formatBytes,
  formatDateTime,
  sortColumns,
  typeCode,
  usageLevel,
} from './browser-view';

describe('browser view helpers', () => {
  it.each([
    [{ isDirectory: true, extension: '' }, 'DIR'],
    [{ isDirectory: false, extension: '.jpg' }, 'JPG'],
    [{ isDirectory: false, extension: '.webmanifest' }, 'WEBM'],
    [{ isDirectory: false, extension: '' }, '—'],
  ])('type code of %j is %s', (entry, code) => {
    expect(typeCode(entry)).toBe(code);
  });

  it('formats exact bytes and sortable dates', () => {
    expect(formatBytes(1048576)).toBe('1.048.576');
    expect(formatDateTime(new Date(2026, 9, 7, 9, 5))).toBe('2026-10-07 09:05');
  });

  it.each([
    [0, 'ok'],
    [74, 'ok'],
    [75, 'warning'],
    [89, 'warning'],
    [90, 'critical'],
    [100, 'critical'],
  ])('a storage use of %d %% is %s', (percent, level) => {
    expect(usageLevel(percent)).toBe(level);
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
