import type { ParseResult } from '../types.js';
import { BufferReader } from '../utils/index.js';
import { getColorSpaceFromString } from '../utils/color-space.js';

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
function parseVP8X(reader: BufferReader): { width: number; height: number; hasICC?: boolean; hasAlpha?: boolean } | null {
  if (!reader.canRead(10)) {
    return null;
  }

  // Read flags byte
  const flags = reader.readUInt8();

  // Extract flag bits
  const hasICC = (flags & 0x20) !== 0;  // Bit 5: ICC profile
  const hasAlpha = (flags & 0x10) !== 0; // Bit 4: Alpha channel

  // Skip reserved bits (3 bytes)
  reader.skip(3);

  // Read canvas width and height (3 bytes each, little-endian)
  const widthBytes = reader.readBytes(3);
  const heightBytes = reader.readBytes(3);

  // Convert 3-byte little-endian to number and add 1
  const width = ((widthBytes[0] ?? 0) | ((widthBytes[1] ?? 0) << 8) | ((widthBytes[2] ?? 0) << 16)) + 1;
  const height = ((heightBytes[0] ?? 0) | ((heightBytes[1] ?? 0) << 8) | ((heightBytes[2] ?? 0) << 16)) + 1;

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

      case 'ICCP':
        // ICC Profile chunk
        if (chunkSize > 0 && reader.canRead(Math.min(chunkSize, 256))) {
          // WebP ICCP chunk contains raw ICC profile data
          // ICC profile structure:
          // - Bytes 0-127: Profile header
          // - After header: Tagged element table
          // The profile description is typically in a 'desc' tag

          // Look for the 'desc' tag in the ICC profile
          const searchLimit = Math.min(chunkSize, 512);
          if (reader.canRead(searchLimit)) {
            const profileData = reader.readBytes(searchLimit);

            // Search for 'desc' tag (0x64657363)
            const descTag = Buffer.from([0x64, 0x65, 0x73, 0x63]);
            const descIndex = profileData.indexOf(descTag);

            if (descIndex > 0 && descIndex + 12 < profileData.length) {
              // Skip 'desc' tag (4 bytes) and reserved (4 bytes) to get to offset
              const descOffset = profileData.readUInt32BE(descIndex + 4);
              const descSize = profileData.readUInt32BE(descIndex + 8);

              // The description starts at descOffset from the beginning of the profile
              if (descOffset < profileData.length && descSize > 0) {
                // Read description type signature (4 bytes)
                const typeSignature = profileData.readUInt32BE(descOffset);

                // 0x64657363 = 'desc' - text description type
                if (typeSignature === 0x64657363 && descOffset + 12 < profileData.length) {
                  // Skip reserved (4 bytes) and get ASCII string length
                  const asciiLength = profileData.readUInt32BE(descOffset + 8);

                  if (asciiLength > 0 && descOffset + 12 + asciiLength <= profileData.length) {
                    // Read ASCII string (null-terminated)
                    const nameBytes = profileData.subarray(descOffset + 12, descOffset + 12 + asciiLength);
                    iccProfileName = nameBytes.toString('ascii').replace(/\0/g, '').trim();
                  }
                }
              }
            }

            // Alternative: Try to find profile description in a simpler way
            // Look for common profile names in the data
            if (!iccProfileName) {
              // Convert to string, replacing null bytes with spaces to make pattern matching work
              const profileStr = profileData.toString('ascii', 0, searchLimit).replace(/\0/g, ' ');

              // Common ICC profile patterns
              const profilePatterns: { pattern: RegExp; name: string }[] = [
                { pattern: /Adobe RGB \(1998\)/, name: 'Adobe RGB (1998)' },
                { pattern: /sRGB IEC61966-2\.1/, name: 'sRGB IEC61966-2.1' },
                { pattern: /Display P3/, name: 'Display P3' },
                { pattern: /ProPhoto RGB/, name: 'ProPhoto RGB' },
                { pattern: /Rec\. 2020/, name: 'Rec. 2020' },
                { pattern: /DCI-P3/, name: 'DCI-P3' },
              ];

              for (const { pattern, name } of profilePatterns) {
                const match = profileStr.match(pattern);
                if (match) {
                  iccProfileName = name;
                  colorSpace = getColorSpaceFromString(name);
                  break;
                }
              }
            }

            // Debug: If still no name found, look for any ASCII string after 'desc'
            if (!iccProfileName && descIndex > 0) {
              // Try a simpler approach - just look for readable text after 'desc'
              const startSearch = descIndex + 12; // Skip 'desc' tag and some header bytes
              if (startSearch < profileData.length - 20) {
                // Find the first readable ASCII sequence
                for (let i = startSearch; i < Math.min(startSearch + 200, profileData.length - 1); i++) {
                  const byte = profileData[i] ?? 0;
                  // Look for printable ASCII characters
                  if (byte >= 32 && byte <= 126) {
                    // Found start of text, read until non-printable
                    let endPos = i;
                    while (endPos < profileData.length && (profileData[endPos] ?? 0) >= 32 && (profileData[endPos] ?? 0) <= 126) {
                      endPos++;
                    }
                    if (endPos - i > 4) { // Minimum length for a meaningful name
                      const possibleName = profileData.toString('ascii', i, endPos).trim();
                      if (possibleName && !possibleName.includes('text') && !possibleName.includes('Copyright')) {
                        iccProfileName = possibleName;
                        colorSpace = getColorSpaceFromString(possibleName);
                        break;
                      }
                    }
                  }
                }
              }
            }
          }

          // If we found a profile but couldn't identify it
          iccProfileName ??= 'Embedded ICC Profile'; // Without being able to parse the profile, we can't determine the exact color space
          // Don't set colorSpace to avoid confusion

          // Try to determine color space from the profile name if we have one but no color space yet
          if (iccProfileName && !colorSpace) {
            colorSpace = getColorSpaceFromString(iccProfileName);
          }
        }
        break;
    }

    // Move to next chunk (pad to even byte boundary)
    reader.seek(chunkStart + ((chunkSize + 1) & ~1));
  }

  // After processing all chunks, return the result if we have dimensions
  if (width && height && width > 0 && height > 0) {
    const result: ParseResult = {
      width,
      height,
      type: 'webp',
      mime: 'image/webp',
      wUnits: 'px',
      hUnits: 'px',
    };

    // Add metadata if available
    if (colorSpace) {
      result.colorSpace = colorSpace;
    }
    if (iccProfileName) {
      result.iccProfile = iccProfileName;
    }
    if (hasAlpha) {
      result.channels = 4; // RGBA
    } else {
      result.channels = 3; // RGB
    }

    return result;
  }

  return null;
}
