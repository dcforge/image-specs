import type { ParseResult } from '../types.js';
import { BufferReader, getPNGChannels } from '../utils/index.js';

/**
 * PNG chunk types
 */
const CHUNK_TYPES = {
  IHDR: 'IHDR',
  pHYs: 'pHYs',
  eXIf: 'eXIf',
  sRGB: 'sRGB',
  iCCP: 'iCCP',
  gAMA: 'gAMA',
  IEND: 'IEND',
} as const;

/**
 * PNG signature
 */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Parse PNG image format
 */
export function parsePNG(buffer: Buffer): ParseResult | null {
  if (buffer.length < 24) {
    return null;
  }

  // Check PNG signature
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return null;
  }

  const reader = new BufferReader(buffer);
  reader.seek(8); // Skip signature

  let width: number | undefined;
  let height: number | undefined;
  let wResolution: number | undefined;
  let hResolution: number | undefined;
  let bitDepth: number | undefined;
  let colorType: number | undefined;
  let channels: number | undefined;
  let colorSpace: string | undefined;
  let iccProfile: string | undefined;
  let gamma: number | undefined;

  // Parse chunks
  while (reader.remaining() >= 12) {
    // Read chunk
    const chunkLength = reader.readUInt32();
    const chunkType = reader.readString(4);

    if (!reader.canRead(chunkLength + 4)) {
      // Not enough data for chunk data + CRC
      break;
    }

    const chunkDataStart = reader.getPosition();

    switch (chunkType) {
      case CHUNK_TYPES.IHDR:
        if (chunkLength === 13) {
          width = reader.readUInt32();
          height = reader.readUInt32();
          bitDepth = reader.readUInt8();
          colorType = reader.readUInt8();

          // Calculate channels
          channels = getPNGChannels(colorType);

          // Skip compression, filter, and interlace
          reader.skip(3);
        }
        break;

      case CHUNK_TYPES.pHYs:
        if (chunkLength === 9) {
          const xPixelsPerUnit = reader.readUInt32();
          const yPixelsPerUnit = reader.readUInt32();
          const unit = reader.readUInt8();

          if (unit === 1) {
            // Unit is meters
            // Convert pixels per meter to DPI (dots per inch)
            // 1 inch = 0.0254 meters
            wResolution = Math.round(xPixelsPerUnit * 0.0254);
            hResolution = Math.round(yPixelsPerUnit * 0.0254);
          } else if (unit === 0) {
            // Unit is unknown - aspect ratio only
            // Store the values as-is (they represent aspect ratio)
            wResolution = xPixelsPerUnit;
            hResolution = yPixelsPerUnit;
          }
        }
        break;

      case CHUNK_TYPES.eXIf:
        // EXIF data parsing would be complex, skip for now
        // Just note that EXIF data exists
        break;

      case CHUNK_TYPES.sRGB:
        if (chunkLength >= 1) {
          colorSpace = 'sRGB';
        }
        break;

      case CHUNK_TYPES.iCCP:
        if (chunkLength > 0) {
          // Read null-terminated profile name
          const maxNameLength = Math.min(chunkLength, 79);
          let nameEnd = chunkDataStart;

          while (nameEnd < chunkDataStart + maxNameLength) {
            if (reader.peekUInt8() === 0) {
              break;
            }
            reader.skip(1);
            nameEnd++;
          }

          if (nameEnd > chunkDataStart) {
            reader.seek(chunkDataStart);
            iccProfile = reader.readString(nameEnd - chunkDataStart, 'latin1');
          }
        }
        break;

      case CHUNK_TYPES.gAMA:
        if (chunkLength === 4) {
          const gammaValue = reader.readUInt32();
          gamma = gammaValue / 100000;
        }
        break;

      case CHUNK_TYPES.IEND:
        // End of PNG
        break;
    }

    // Skip to next chunk (skip remaining chunk data and CRC)
    reader.seek(chunkDataStart + chunkLength + 4);

    if (chunkType === CHUNK_TYPES.IEND) {
      break;
    }
  }

  if (width !== undefined && height !== undefined && width > 0 && height > 0) {
    const result: ParseResult = {
      width,
      height,
      type: 'png',
      mime: 'image/png',
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
    }
    if (channels !== undefined) {
      result.channels = channels;
    }
    if (colorSpace !== undefined) {
      result.colorSpace = colorSpace;
    }
    if (iccProfile !== undefined) {
      result.iccProfile = iccProfile;
    }
    if (gamma !== undefined) {
      result.gamma = gamma;
    }

    return result;
  }

  return null;
}