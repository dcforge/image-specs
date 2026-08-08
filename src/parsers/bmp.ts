import { defined, type ParseResult } from '../types.js';
import { BufferReader } from '../utils/buffer-reader.js';

/** Size of the smallest DIB header (BITMAPCOREHEADER) */
const BITMAPCOREHEADER = 12;

/** Size of BITMAPINFOHEADER, the first variant carrying resolution fields */
const BITMAPINFOHEADER = 40;

/** Metres per inch, for converting pixels-per-metre to DPI */
const METRES_PER_INCH = 0.0254;

/**
 * Channel count per bit depth: indexed/grayscale, RGB, then RGBA
 */
const CHANNELS_BY_BIT_DEPTH: Record<number, number> = {
  1: 1,
  4: 1,
  8: 1,
  16: 3,
  24: 3,
  32: 4,
};

/**
 * Parse BMP image format
 */
export function parseBMP(buffer: Buffer): ParseResult | null {
  if (buffer.length < 26) {
    return null;
  }

  const reader = new BufferReader(buffer, true); // BMP uses little-endian

  if (reader.readString(2) !== 'BM') {
    return null;
  }

  reader.skip(12); // File size, reserved fields, and data offset

  const dibHeaderSize = reader.readUInt32();
  if (dibHeaderSize < BITMAPCOREHEADER || !reader.canRead(dibHeaderSize - 4)) {
    return null;
  }

  let width: number;
  let height: number;
  let bitDepth: number;
  let wResolution: number | undefined;
  let hResolution: number | undefined;

  if (dibHeaderSize === BITMAPCOREHEADER) {
    width = reader.readUInt16();
    height = reader.readUInt16();
    reader.skip(2); // planes
    bitDepth = reader.readUInt16();
  } else {
    // BITMAPINFOHEADER or larger
    width = reader.readInt32();
    height = Math.abs(reader.readInt32()); // Negative height means top-down
    reader.skip(2); // planes
    bitDepth = reader.readUInt16();
    reader.skip(8); // Compression and image size

    if (dibHeaderSize >= BITMAPINFOHEADER) {
      const xPixelsPerMetre = reader.readInt32();
      const yPixelsPerMetre = reader.readInt32();

      if (xPixelsPerMetre > 0 && yPixelsPerMetre > 0) {
        wResolution = Math.round(xPixelsPerMetre * METRES_PER_INCH);
        hResolution = Math.round(yPixelsPerMetre * METRES_PER_INCH);
      }
    }
  }

  if (width <= 0 || height <= 0) {
    return null;
  }

  return {
    width,
    height,
    type: 'bmp',
    mime: 'image/bmp',
    wUnits: 'px',
    hUnits: 'px',
    ...defined({
      wResolution,
      hResolution,
      bitDepth,
      channels: CHANNELS_BY_BIT_DEPTH[bitDepth],
    }),
  };
}
