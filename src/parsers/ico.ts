import type { ParseResult } from '../types.js';
import { BufferReader } from '../utils/index.js';

/**
 * ICO directory entry structure
 */
interface IcoDirectoryEntry {
  width: number;
  height: number;
  colorCount: number;
  reserved: number;
  planes: number;
  bitCount: number;
  bytesInRes: number;
  imageOffset: number;
}

/**
 * Parse ICO directory entry
 */
function parseDirectoryEntry(reader: BufferReader): IcoDirectoryEntry | null {
  if (!reader.canRead(16)) {
    return null;
  }

  const width = reader.readUInt8() || 256; // 0 means 256
  const height = reader.readUInt8() || 256; // 0 means 256
  const colorCount = reader.readUInt8();
  const reserved = reader.readUInt8();
  const planes = reader.readUInt16();
  const bitCount = reader.readUInt16();
  const bytesInRes = reader.readUInt32();
  const imageOffset = reader.readUInt32();

  return {
    width,
    height,
    colorCount,
    reserved,
    planes,
    bitCount,
    bytesInRes,
    imageOffset,
  };
}

/**
 * Parse ICO image format
 */
export function parseICO(buffer: Buffer): ParseResult | null {
  if (buffer.length < 6) {
    return null;
  }

  const reader = new BufferReader(buffer, true); // ICO uses little-endian

  // Check ICO header
  const reserved = reader.readUInt16();
  const type = reader.readUInt16();
  const count = reader.readUInt16();

  // ICO files have reserved=0, type=1, and at least 1 image
  if (reserved !== 0 || type !== 1 || count === 0) {
    return null;
  }

  // Check if we have enough data for the directory entries
  if (!reader.canRead(count * 16)) {
    return null;
  }

  // Parse directory entries to find the largest image
  let maxWidth = 0;
  let maxHeight = 0;
  let bestEntry: IcoDirectoryEntry | null = null;

  for (let i = 0; i < count; i++) {
    const entry = parseDirectoryEntry(reader);

    if (entry && entry.width > 0 && entry.height > 0) {
      // Prefer the largest image, or highest bit depth if same size
      if (
        entry.width > maxWidth ||
        (entry.width === maxWidth && entry.height > maxHeight) ||
        (entry.width === maxWidth &&
          entry.height === maxHeight &&
          entry.bitCount > (bestEntry?.bitCount ?? 0))
      ) {
        maxWidth = entry.width;
        maxHeight = entry.height;
        bestEntry = entry;
      }
    }
  }

  if (bestEntry) {
    return {
      width: bestEntry.width,
      height: bestEntry.height,
      type: 'ico',
      mime: 'image/x-icon',
      wUnits: 'px',
      hUnits: 'px',
    };
  }

  return null;
}
