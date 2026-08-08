import { defined, type ParseResult } from '../types.js';
import { BufferReader } from '../utils/buffer-reader.js';

/**
 * PNG signature
 */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Channel count per IHDR color type (grayscale, RGB, palette, gray+alpha, RGBA)
 */
const CHANNELS_BY_COLOR_TYPE: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** Maximum length of an iCCP profile name, per the PNG specification */
const MAX_ICC_NAME_LENGTH = 79;

/** Metres per inch, for converting pHYs pixels-per-metre to DPI */
const METRES_PER_INCH = 0.0254;

/**
 * Parse PNG image format
 */
export function parsePNG(buffer: Buffer): ParseResult | null {
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return null;
  }

  const reader = new BufferReader(buffer);
  reader.seek(8); // Skip signature

  let width: number | undefined;
  let height: number | undefined;
  let wResolution: number | undefined;
  let hResolution: number | undefined;
  let bitDepth: number | undefined;
  let channels: number | undefined;
  let colorSpace: string | undefined;
  let iccProfile: string | undefined;
  let gamma: number | undefined;

  while (reader.remaining() >= 12) {
    const chunkLength = reader.readUInt32();
    const chunkType = reader.readString(4);

    // Not enough data for chunk data + CRC
    if (!reader.canRead(chunkLength + 4)) {
      break;
    }

    const chunkDataStart = reader.getPosition();

    switch (chunkType) {
      case 'IHDR':
        if (chunkLength === 13) {
          width = reader.readUInt32();
          height = reader.readUInt32();
          bitDepth = reader.readUInt8();
          channels = CHANNELS_BY_COLOR_TYPE[reader.readUInt8()] ?? 3;
        }
        break;

      case 'pHYs':
        if (chunkLength === 9) {
          const xPixelsPerUnit = reader.readUInt32();
          const yPixelsPerUnit = reader.readUInt32();
          const unit = reader.readUInt8();

          if (unit === 1) {
            // Pixels per metre, convert to DPI
            wResolution = Math.round(xPixelsPerUnit * METRES_PER_INCH);
            hResolution = Math.round(yPixelsPerUnit * METRES_PER_INCH);
          } else if (unit === 0) {
            // Unit unknown, the values carry aspect ratio only
            wResolution = xPixelsPerUnit;
            hResolution = yPixelsPerUnit;
          }
        }
        break;

      case 'sRGB':
        if (chunkLength >= 1) {
          colorSpace = 'sRGB';
        }
        break;

      case 'iCCP':
        if (chunkLength > 0) {
          const name = reader.readBytes(Math.min(chunkLength, MAX_ICC_NAME_LENGTH));
          const terminator = name.indexOf(0);
          iccProfile =
            name.toString('latin1', 0, terminator < 0 ? name.length : terminator) || undefined;
        }
        break;

      case 'gAMA':
        if (chunkLength === 4) {
          gamma = reader.readUInt32() / 100000;
        }
        break;
    }

    // Skip any unread chunk data plus the CRC
    reader.seek(chunkDataStart + chunkLength + 4);

    if (chunkType === 'IEND') {
      break;
    }
  }

  if (width === undefined || height === undefined || width <= 0 || height <= 0) {
    return null;
  }

  return {
    width,
    height,
    type: 'png',
    mime: 'image/png',
    wUnits: 'px',
    hUnits: 'px',
    ...defined({ wResolution, hResolution, bitDepth, channels, colorSpace, iccProfile, gamma }),
  };
}
