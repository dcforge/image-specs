import type { ParseResult } from '../types.js';
import { BufferReader } from '../utils/index.js';

/**
 * BMP DIB header types
 */
const DIB_HEADER_TYPES = {
  BITMAPCOREHEADER: 12,
  BITMAPINFOHEADER: 40,
  BITMAPV2INFOHEADER: 52,
  BITMAPV3INFOHEADER: 56,
  BITMAPV4HEADER: 108,
  BITMAPV5HEADER: 124,
} as const;

/**
 * Parse BMP image format
 */
export function parseBMP(buffer: Buffer): ParseResult | null {
  if (buffer.length < 26) {
    return null;
  }

  const reader = new BufferReader(buffer, true); // BMP uses little-endian

  // Check BMP signature
  const signature = reader.readString(2);
  if (signature !== 'BM') {
    return null;
  }

  // Skip file size and reserved fields
  reader.skip(8);

  // Skip data offset
  reader.skip(4);

  // Read DIB header size
  const dibHeaderSize = reader.readUInt32();

  // Check if we have enough data for the header
  if (!reader.canRead(dibHeaderSize - 4)) {
    return null;
  }

  let width: number;
  let height: number;
  let wResolution: number | undefined;
  let hResolution: number | undefined;
  let bitDepth: number | undefined;

  if (dibHeaderSize >= DIB_HEADER_TYPES.BITMAPCOREHEADER) {
    if (dibHeaderSize === DIB_HEADER_TYPES.BITMAPCOREHEADER) {
      // BITMAPCOREHEADER
      width = reader.readUInt16();
      height = reader.readUInt16();
      reader.skip(2); // planes
      bitDepth = reader.readUInt16();
    } else {
      // BITMAPINFOHEADER or larger
      width = reader.readInt32();
      height = reader.readInt32();

      // Height can be negative (top-down bitmap)
      height = Math.abs(height);

      reader.skip(2); // planes
      bitDepth = reader.readUInt16();

      // Skip compression and image size
      reader.skip(8);

      // Read resolution if available
      if (dibHeaderSize >= DIB_HEADER_TYPES.BITMAPINFOHEADER) {
        const xPixelsPerMeter = reader.readInt32();
        const yPixelsPerMeter = reader.readInt32();

        if (xPixelsPerMeter > 0 && yPixelsPerMeter > 0) {
          // Convert pixels per meter to DPI
          wResolution = Math.round(xPixelsPerMeter * 0.0254);
          hResolution = Math.round(yPixelsPerMeter * 0.0254);
        }
      }
    }

    if (width > 0 && height > 0) {
      const result: ParseResult = {
        width,
        height,
        type: 'bmp',
        mime: 'image/bmp',
        wUnits: 'px',
        hUnits: 'px',
      };

      if (wResolution !== undefined) {
        result.wResolution = wResolution;
      }
      if (hResolution !== undefined) {
        result.hResolution = hResolution;
      }
      if (bitDepth !== undefined) {
        result.bitDepth = bitDepth;

        // Calculate channels based on bit depth
        if (bitDepth === 1 || bitDepth === 4 || bitDepth === 8) {
          result.channels = 1; // Indexed/grayscale
        } else if (bitDepth === 16 || bitDepth === 24) {
          result.channels = 3; // RGB
        } else if (bitDepth === 32) {
          result.channels = 4; // RGBA
        }
      }

      return result;
    }
  }

  return null;
}