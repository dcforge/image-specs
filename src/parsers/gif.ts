import type { ParseResult } from '../types.js';
import { BufferReader } from '../utils/index.js';

/**
 * Parse GIF image format
 */
export function parseGIF(buffer: Buffer): ParseResult | null {
  if (buffer.length < 10) {
    return null;
  }

  const reader = new BufferReader(buffer, true); // GIF uses little-endian

  // Check GIF signature
  const signature = reader.readString(6);
  if (signature !== 'GIF87a' && signature !== 'GIF89a') {
    return null;
  }

  // Read logical screen descriptor
  const width = reader.readUInt16();
  const height = reader.readUInt16();

  if (width === 0 || height === 0) {
    return null;
  }

  return {
    width,
    height,
    type: 'gif',
    mime: 'image/gif',
    wUnits: 'px',
    hUnits: 'px',
  };
}
