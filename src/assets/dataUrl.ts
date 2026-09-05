/** Decode base64 data URLs only; remote URLs and percent-encoded payloads are not assets. */
export function parseDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const match = /^data:([^,;]*)(?:;[^,;=]+=[^,;]*)*;base64,([\s\S]*)$/i.exec(dataUrl);
  if (!match) return null;
  try {
    const binary = atob(match[2]);
    return {
      mime: match[1] || 'text/plain',
      bytes: Uint8Array.from(binary, (char) => char.charCodeAt(0)),
    };
  } catch {
    return null;
  }
}

export function toDataUrl(bytes: Uint8Array, mime: string): string {
  // Chunking avoids argument limits for multi-megabyte images.
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
  }
  return `data:${mime};base64,${btoa(chunks.join(''))}`;
}
