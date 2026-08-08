import { defined, type ParseResult } from '../types.js';
import { BufferReader } from '../utils/buffer-reader.js';
import { identifyIccProfile } from '../utils/color-space.js';

/** How much of an ICC profile to read when looking for its description */
const ICC_SCAN_LIMIT = 512;

/**
 * Parse WebP VP8 chunk
 */
function parseVP8(reader: BufferReader): { width: number; height: number } | null {
  if (!reader.canRead(10)) {
    return null;
  }

  // Skip VP8 frame header (3 bytes)
  reader.skip(3);

  // Read start code
  const startCode = reader.readBytes(3);
  if (!startCode.equals(Buffer.from([0x9d, 0x01, 0x2a]))) {
    return null;
  }

  const sizeInfo = reader.readUInt32();
  const width = sizeInfo & 0x3fff;
  const height = (sizeInfo >> 16) & 0x3fff;

  return { width, height };
}

/**
 * Parse WebP VP8L chunk
 */
function parseVP8L(reader: BufferReader): { width: number; height: number } | null {
  if (!reader.canRead(5)) {
    return null;
  }

  // Check VP8L signature
  if (reader.readUInt8() !== 0x2f) {
    return null;
  }

  // Read width and height from bitstream
  const bits = reader.readUInt32();
  const width = (bits & 0x3fff) + 1;
  const height = ((bits >> 14) & 0x3fff) + 1;

  return { width, height };
}

/**
 * Parse WebP VP8X chunk
 */
function parseVP8X(
  reader: BufferReader
): { width: number; height: number; hasICC?: boolean; hasAlpha?: boolean } | null {
  if (!reader.canRead(10)) {
    return null;
  }

  // Read flags byte
  const flags = reader.readUInt8();

  // Extract flag bits
  const hasICC = (flags & 0x20) !== 0; // Bit 5: ICC profile
  const hasAlpha = (flags & 0x10) !== 0; // Bit 4: Alpha channel

  // Skip reserved bits (3 bytes)
  reader.skip(3);

  // Read canvas width and height (3 bytes each, little-endian)
  const widthBytes = reader.readBytes(3);
  const heightBytes = reader.readBytes(3);

  // Convert 3-byte little-endian to number and add 1
  const width =
    ((widthBytes[0] ?? 0) | ((widthBytes[1] ?? 0) << 8) | ((widthBytes[2] ?? 0) << 16)) + 1;
  const height =
    ((heightBytes[0] ?? 0) | ((heightBytes[1] ?? 0) << 8) | ((heightBytes[2] ?? 0) << 16)) + 1;

  return { width, height, hasICC, hasAlpha };
}

/**
 * Parse WebP image format
 */
export function parseWebP(buffer: Buffer): ParseResult | null {
  if (buffer.length < 12) {
    return null;
  }

  const reader = new BufferReader(buffer, true); // WebP uses little-endian

  // Check RIFF signature
  if (reader.readString(4) !== 'RIFF') {
    return null;
  }

  // Skip file size
  reader.skip(4);

  // Check WebP signature
  if (reader.readString(4) !== 'WEBP') {
    return null;
  }

  let width: number | undefined;
  let height: number | undefined;
  let hasAlpha = false;
  let colorSpace: string | undefined;
  let iccProfileName: string | undefined;

  // First pass: look for VP8X to get metadata flags
  const firstPassPosition = reader.getPosition();
  while (reader.canRead(8)) {
    const chunkId = reader.readString(4);
    const chunkSize = reader.readUInt32();

    if (!reader.canRead(chunkSize)) {
      break;
    }

    const chunkStart = reader.getPosition();

    if (chunkId === 'VP8X') {
      const vp8xData = parseVP8X(reader);
      if (vp8xData) {
        width = vp8xData.width;
        height = vp8xData.height;
        hasAlpha = vp8xData.hasAlpha ?? false;
        // hasICC flag just indicates presence, actual color space will be extracted from the profile
      }
      break;
    }

    // Move to next chunk (pad to even byte boundary)
    reader.seek(chunkStart + ((chunkSize + 1) & ~1));
  }

  // Reset to start of chunks for second pass
  reader.seek(firstPassPosition);

  while (reader.canRead(8)) {
    const chunkId = reader.readString(4);
    const chunkSize = reader.readUInt32();

    if (!reader.canRead(chunkSize)) {
      break;
    }

    const chunkStart = reader.getPosition();

    switch (chunkId) {
      case 'VP8 ':
        if (!width || !height) {
          const vp8Data = parseVP8(reader);
          if (vp8Data) {
            width = vp8Data.width;
            height = vp8Data.height;
          }
        }
        break;

      case 'VP8L':
        if (!width || !height) {
          const vp8lData = parseVP8L(reader);
          if (vp8lData) {
            width = vp8lData.width;
            height = vp8lData.height;
            hasAlpha = true; // VP8L always supports alpha
          }
        }
        break;

      case 'VP8X':
        // Already handled in first pass
        break;

      case 'ICCP': {
        // Raw ICC profile data: a 128-byte header followed by a tagged
        // element table holding the profile description
        const profileSize = Math.min(chunkSize, ICC_SCAN_LIMIT);
        if (profileSize > 0 && reader.canRead(profileSize)) {
          const profile = identifyIccProfile(reader.readBytes(profileSize));
          iccProfileName = profile.iccProfile ?? 'Embedded ICC Profile';
          colorSpace = profile.colorSpace;
        }
        break;
      }
    }

    // Move to next chunk (pad to even byte boundary)
    reader.seek(chunkStart + ((chunkSize + 1) & ~1));
  }

  // After processing all chunks, return the result if we have dimensions
  if (!width || !height || width <= 0 || height <= 0) {
    return null;
  }

  return {
    width,
    height,
    type: 'webp',
    mime: 'image/webp',
    wUnits: 'px',
    hUnits: 'px',
    ...defined({ colorSpace, iccProfile: iccProfileName }),
    channels: hasAlpha ? 4 : 3, // RGBA or RGB
  };
}
