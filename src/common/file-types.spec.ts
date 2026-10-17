import { formatSize, mimeTypeFor } from './file-types';

describe('formatSize (C2)', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [2048, '2 KB'], // used to show as "1 MB"
    [1536, '1.5 KB'],
    [1.5 * 1024 * 1024, '1.5 MB'],
    [250 * 1024 * 1024, '250 MB'],
    [3.2 * 1024 ** 3, '3.2 GB'],
    [2 * 1024 ** 5, '2048 TB'],
  ])('%d bytes -> %s', (bytes, label) => {
    expect(formatSize(bytes)).toBe(label);
  });
});

describe('mimeTypeFor', () => {
  it('knows common types and falls back to octet-stream', () => {
    expect(mimeTypeFor('.pdf')).toBe('application/pdf');
    expect(mimeTypeFor('.nope')).toBe('application/octet-stream');
  });
});
