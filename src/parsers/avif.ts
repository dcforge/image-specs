import type { ParseResult } from '../types.js';
import { BufferReader } from '../utils/index.js';

/**
 * Determine color space from ICC profile data (similar to WebP)
 */
function getColorSpaceFromProfileData(profileData: Buffer): { profileName?: string; colorSpace?: string } {
  // Convert to string, looking for common profile names
  const profileStr = profileData.toString('ascii', 0, Math.min(profileData.length, 512)).replace(/\0/g, ' ');

  // Common ICC profile patterns
  const patterns = [
    { pattern: /Adobe RGB \(1998\)/, name: 'Adobe RGB (1998)', colorSpace: 'Adobe RGB' },
    { pattern: /sRGB IEC61966-2\.1/, name: 'sRGB IEC61966-2.1', colorSpace: 'sRGB' },
    { pattern: /Display P3/, name: 'Display P3', colorSpace: 'Display P3' },
    { pattern: /ProPhoto RGB/, name: 'ProPhoto RGB', colorSpace: 'ProPhoto RGB' },
    { pattern: /Rec\. 2020/, name: 'Rec. 2020', colorSpace: 'Rec. 2020' },
    { pattern: /DCI-P3/, name: 'DCI-P3', colorSpace: 'DCI-P3' },
  ];

  for (const { pattern, name, colorSpace } of patterns) {
    const match = profileStr.match(pattern);
    if (match) {
      return { profileName: name, colorSpace };
    }
  }

  return {};
}

/**
 * Parse ftyp box to verify AVIF format
 */
function parseFtyp(reader: BufferReader, size: number): boolean {
  if (!reader.canRead(8) || size < 8) {
    return false;
  }

  const majorBrand = reader.readString(4);

  // Check for AVIF major brand
  if (majorBrand === 'avif') {
    return true;
  }

  // Skip minor version
  reader.skip(4);

  // Check compatible brands
  const compatibleBrandsSize = size - 8;
  let brandsRead = 0;

  while (brandsRead < compatibleBrandsSize && reader.canRead(4)) {
    const brand = reader.readString(4);
    if (brand === 'avif' || brand === 'avis') {
      return true;
    }
    brandsRead += 4;
  }

  return false;
}

/**
 * Parse ispe (Image Spatial Extents) box for dimensions
 */
function parseIspe(reader: BufferReader): { width: number; height: number } | null {
  if (!reader.canRead(12)) {
    return null;
  }

  // Skip version and flags (4 bytes)
  reader.skip(4);
  const width = reader.readUInt32();
  const height = reader.readUInt32();

  return { width, height };
}

/**
 * Parse colr (Color Information) box
 */
function parseColr(reader: BufferReader, size: number): {
  colorSpace?: string;
  iccProfile?: string;
  colorPrimaries?: number;
  transferCharacteristics?: number;
} | null {
  if (!reader.canRead(4)) {
    return null;
  }

  const colorType = reader.readString(4);

  if (colorType === 'prof' || colorType === 'rICC') {
    // ICC profile
    const iccDataSize = size - 4;
    if (reader.canRead(iccDataSize)) {
      const iccData = reader.readBytes(iccDataSize);
      const { profileName, colorSpace } = getColorSpaceFromProfileData(iccData);
      return {
        colorSpace: colorSpace ?? 'ICC Profile',
        iccProfile: profileName ?? 'Embedded ICC Profile'
      };
    }
  } else if (colorType === 'nclx') {
    // Color parameters
    if (reader.canRead(7)) {
      const colorPrimaries = reader.readUInt16();
      const transferCharacteristics = reader.readUInt16();
      reader.skip(2); // Skip matrix coefficients
      reader.skip(1); // Skip full range flag

      // Determine color space from color primaries
      let colorSpace: string | undefined;
      switch (colorPrimaries) {
        case 1: // BT.709
          colorSpace = 'sRGB';
          break;
        case 9: // BT.2020
          colorSpace = 'Rec. 2020';
          break;
        case 11: // DCI P3
          colorSpace = 'DCI-P3';
          break;
        case 12: // Display P3
          colorSpace = 'Display P3';
          break;
      }

      const result: {
        colorSpace?: string;
        iccProfile?: string;
        colorPrimaries?: number;
        transferCharacteristics?: number;
      } = {};

      if (colorSpace) {
        result.colorSpace = colorSpace;
      }
      result.colorPrimaries = colorPrimaries;
      result.transferCharacteristics = transferCharacteristics;

      return result;
    }
  }

  return null;
}

/**
 * Parse AVIF box structure
 */
function parseBox(
  reader: BufferReader
): { type: string; size: number; dataOffset: number } | null {
  const boxStart = reader.getPosition();

  if (!reader.canRead(8)) {
    return null;
  }

  let size = reader.readUInt32();
  const type = reader.readString(4);
  let dataOffset = reader.getPosition();

  // Handle extended size
  if (size === 1) {
    if (!reader.canRead(8)) {
      return null;
    }
    // Read 64-bit size (we'll only use the lower 32 bits)
    reader.skip(4); // Skip upper 32 bits
    size = reader.readUInt32();
    dataOffset = reader.getPosition();
  } else if (size === 0) {
    // Box extends to end of file
    size = reader.getBuffer().length - boxStart;
  }

  return { type, size, dataOffset };
}

/**
 * Find and parse a specific box type
 */
function findBox(
  reader: BufferReader,
  endPosition: number,
  boxType: string
): { position: number; size: number } | null {
  while (reader.getPosition() < endPosition) {
    const boxStart = reader.getPosition();
    const box = parseBox(reader);
    if (!box) {
      break;
    }

    if (box.type === boxType) {
      return { position: box.dataOffset, size: box.size - (box.dataOffset - boxStart) };
    }

    reader.seek(boxStart + box.size);
  }

  return null;
}

/**
 * Parse AVIF image format
 */
export function parseAVIF(buffer: Buffer): ParseResult | null {
  if (buffer.length < 12) {
    return null;
  }

  const reader = new BufferReader(buffer); // AVIF uses big-endian
  let isAVIF = false;
  let width: number | undefined;
  let height: number | undefined;
  let colorSpace: string | undefined;
  let iccProfile: string | undefined;
  let bitDepth: number | undefined;
  let channels: number | undefined;

  while (reader.remaining() > 0) {
    const boxStart = reader.getPosition();
    const box = parseBox(reader);
    if (!box) {
      break;
    }

    switch (box.type) {
      case 'ftyp':
        reader.seek(box.dataOffset);
        isAVIF = parseFtyp(reader, box.size - (box.dataOffset - boxStart));
        break;

      case 'meta':
        if (isAVIF) {
          reader.seek(box.dataOffset);
          // Skip version and flags (4 bytes) in meta box
          reader.skip(4);
          const metaDataEnd = boxStart + box.size;

          // Look for iprp (Item Properties) box
          const iprpBox = findBox(reader, metaDataEnd, 'iprp');
          if (iprpBox) {
            reader.seek(iprpBox.position);
            const iprpEnd = iprpBox.position + iprpBox.size;

            // Look for ipco (Item Property Container) box inside iprp
            const ipcoBox = findBox(reader, iprpEnd, 'ipco');
            if (ipcoBox) {
              reader.seek(ipcoBox.position);
              const ipcoEnd = ipcoBox.position + ipcoBox.size;

              // Look for ispe (Image Spatial Extents) box inside ipco
              const ispeBox = findBox(reader, ipcoEnd, 'ispe');
              if (ispeBox) {
                reader.seek(ispeBox.position);
                const dimensions = parseIspe(reader);
                if (dimensions) {
                  width = dimensions.width;
                  height = dimensions.height;
                }
              }

              // Look for colr (Color Information) box inside ipco
              reader.seek(ipcoBox.position);
              const colrBox = findBox(reader, ipcoEnd, 'colr');
              if (colrBox) {
                reader.seek(colrBox.position);
                const colorInfo = parseColr(reader, colrBox.size);
                if (colorInfo) {
                  colorSpace = colorInfo.colorSpace;
                  iccProfile = colorInfo.iccProfile;
                }
              }

              // Look for pixi (Pixel Information) box for bit depth
              reader.seek(ipcoBox.position);
              const pixiBox = findBox(reader, ipcoEnd, 'pixi');
              if (pixiBox) {
                reader.seek(pixiBox.position);
                if (reader.canRead(5)) {
                  // Skip version and flags
                  reader.skip(4);
                  const channelCount = reader.readUInt8();
                  channels = channelCount;
                  if (reader.canRead(channelCount)) {
                    // Read bits per channel for first channel as bit depth
                    bitDepth = reader.readUInt8();
                  }
                }
              }
            }
          }
        }
        break;
    }

    reader.seek(boxStart + box.size);

    // Stop if we found dimensions
    if (width !== undefined && height !== undefined) {
      break;
    }
  }

  if (isAVIF && width !== undefined && height !== undefined && width > 0 && height > 0) {
    const result: ParseResult = {
      width,
      height,
      type: 'avif',
      mime: 'image/avif',
      wUnits: 'px',
      hUnits: 'px',
    };

    // Add optional metadata
    if (colorSpace) {
      result.colorSpace = colorSpace;
    }
    if (iccProfile) {
      result.iccProfile = iccProfile;
    }
    if (bitDepth) {
      result.bitDepth = bitDepth;
    }
    if (channels) {
      result.channels = channels;
    }

    return result;
  }

  return null;
}
