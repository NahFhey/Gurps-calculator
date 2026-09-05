import { describe, expect, it } from 'vitest';
import { parseDataUrl, toDataUrl } from '../dataUrl';

describe('data URL codec', () => {
  it('round trips binary bytes including zero and high bytes, with MIME', () => {
    const bytes = Uint8Array.from({ length: 100000 }, (_, i) => i % 256);
    expect(parseDataUrl(toDataUrl(bytes, 'image/jpeg'))).toEqual({ mime: 'image/jpeg', bytes });
    expect(toDataUrl(new Uint8Array([1, 2, 3]), 'image/png')).toBe('data:image/png;base64,AQID');
  });
  it('supports empty bytes and MIME parameters', () => {
    expect(parseDataUrl('data:image/svg+xml;charset=utf-8;base64,')).toEqual({ mime: 'image/svg+xml', bytes: new Uint8Array() });
  });
  it.each(['https://example.com/image.jpg', 'AQID', 'data:text/plain,hello', 'data:image/png;base64,%%%', 'data:image/png;base64,A'])('rejects %s', (input) => {
    expect(parseDataUrl(input)).toBeNull();
  });
});
