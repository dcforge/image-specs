import type { ParseResult } from '../types.js';
import { BufferReader } from '../utils/buffer-reader.js';

/** Bytes per ICO directory entry */
const ENTRY_SIZE = 16;

/**
 * The parts of an ICO directory entry that decide which image we report
 */
interface IcoEntry {
  width: number;
  height: number;
  bitCount: number;
}

/**
 * Read one 16-byte ICO directory entry
 */
function readDirectoryEntry(reader: BufferReader): IcoEntry {
  const width = reader.readUInt8() || 256; // 0 means 256
  const height = reader.readUInt8() || 256; // 0 means 256
  reader.skip(4); // colorCount, reserved, planes
  const bitCount = reader.readUInt16();
  reader.skip(8); // bytesInRes, imageOffset

  return { width, height, bitCount };
}

/**
 * Prefer the largest image, breaking ties on colour depth
 */
function isBetter(entry: IcoEntry, best: IcoEntry): boolean {
  if (entry.width !== best.width) return entry.width > best.width;
  if (entry.height !== best.height) return entry.height > best.height;
  return entry.bitCount > best.bitCount;
}

/**
 * Parse ICO image format
 */
export function parseICO(buffer: Buffer): ParseResult | null {
  if (buffer.length < 6) {
    return null;
  }

  const reader = new BufferReader(buffer, true); // ICO uses little-endian

  const reserved = reader.readUInt16();
  const type = reader.readUInt16();
  const count = reader.readUInt16();

  // ICO files have reserved=0, type=1, and at least one image
  if (reserved !== 0 || type !== 1 || count === 0 || !reader.canRead(count * ENTRY_SIZE)) {
    return null;
  }

  let best = readDirectoryEntry(reader);

  for (let i = 1; i < count; i++) {
    const entry = readDirectoryEntry(reader);
    if (isBetter(entry, best)) {
      best = entry;
    }
  }

  return {
    width: best.width,
    height: best.height,
    type: 'ico',
    mime: 'image/x-icon',
    wUnits: 'px',
    hUnits: 'px',
  };
}
