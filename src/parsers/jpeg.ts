import { defined, type ParseResult } from '../types.js';
import { BufferReader } from '../utils/buffer-reader.js';
import { getColorSpaceFromString, getColorSpaceFromTag } from '../utils/color-space.js';

/**
 * JPEG segment markers
 */
const MARKERS = {
  SOI: 0xffd8, // Start of Image
  EOI: 0xffd9, // End of Image
  APP0: 0xffe0, // Application Specific (JFIF)
  APP1: 0xffe1, // Application Specific (EXIF)
  APP2: 0xffe2, // Application Specific (ICC Profile)
  APP14: 0xffee, // Application Specific (Adobe)
} as const;

/** Centimetres per inch, for converting densities to DPI */
const CM_PER_INCH = 2.54;

/**
 * Color space implied by the SOF component count, used only as a last resort
 */
const COLOR_SPACE_BY_COMPONENTS: Record<number, string> = { 1: 'Grayscale', 3: 'RGB', 4: 'CMYK' };

/**
 * Check if a marker is a Start of Frame marker.
 *
 * SOF markers occupy 0xFFC0-0xFFCF apart from three slots taken by other
 * segment types.
 */
function isSOFMarker(marker: number): boolean {
  return (
    (marker & 0xfff0) === 0xffc0 &&
    marker !== 0xffc4 && // DHT (Define Huffman Table)
    marker !== 0xffc8 && // JPG (reserved)
    marker !== 0xffcc // DAC (Define Arithmetic Coding)
  );
}

/**
 * Parse JFIF app0 segment for resolution information
 */
function parseJFIF(reader: BufferReader): { wResolution?: number; hResolution?: number } {
  // JFIF identifier should be "JFIF\0"
  if (!reader.canRead(14) || reader.readString(5) !== 'JFIF\0') {
    return {};
  }

  reader.skip(2); // Skip version
  const densityUnits = reader.readUInt8();
  const xDensity = reader.readUInt16();
  const yDensity = reader.readUInt16();

  // Convert density to DPI based on units
  if (densityUnits === 1) {
    // dots per inch
    return { wResolution: xDensity, hResolution: yDensity };
  }

  if (densityUnits === 2) {
    // dots per cm
    return {
      wResolution: Math.round(xDensity * CM_PER_INCH),
      hResolution: Math.round(yDensity * CM_PER_INCH),
    };
  }

  return {};
}

/**
 * EXIF/TIFF tags carrying resolution information
 */
const EXIF_TAGS = {
  X_RESOLUTION: 0x011a,
  Y_RESOLUTION: 0x011b,
  RESOLUTION_UNIT: 0x0128,
} as const;

/**
 * Read a TIFF RATIONAL (two uint32s) from an absolute offset, restoring the
 * reader's position afterwards
 */
function readRational(reader: BufferReader, offset: number): number | undefined {
  if (offset + 8 > reader.getBuffer().length) {
    return undefined;
  }

  const saved = reader.getPosition();
  reader.seek(offset);
  const numerator = reader.readUInt32();
  const denominator = reader.readUInt32();
  reader.seek(saved);

  return denominator > 0 ? numerator / denominator : undefined;
}

/**
 * Parse EXIF app1 segment for resolution information
 */
function parseEXIF(reader: BufferReader): { wResolution?: number; hResolution?: number } {
  // Check for EXIF identifier
  if (!reader.canRead(6) || reader.readString(6) !== 'Exif\0\0') {
    return {};
  }

  const tiffStart = reader.getPosition();
  if (!reader.canRead(8)) {
    return {};
  }

  // Check byte order (MM for big-endian, II for little-endian)
  const byteOrder = reader.readString(2);
  const isLittleEndian = byteOrder === 'II';

  // Create a new reader with proper endianness for TIFF data
  const tiffReader = new BufferReader(reader.getBuffer(), isLittleEndian);
  tiffReader.seek(tiffStart);
  tiffReader.skip(2); // Skip byte order marker

  // Skip TIFF magic number
  tiffReader.skip(2);

  // Read IFD offset
  const ifdOffset = tiffReader.readUInt32() + tiffStart;
  if (ifdOffset + 2 > reader.getBuffer().length) {
    return {};
  }

  tiffReader.seek(ifdOffset);

  // Read number of directory entries
  const numEntries = tiffReader.readUInt16();

  let xResolution: number | undefined;
  let yResolution: number | undefined;
  let resolutionUnit = 2; // Default to inches

  // Parse IFD entries
  for (let i = 0; i < numEntries; i++) {
    if (!tiffReader.canRead(12)) break;

    const tag = tiffReader.readUInt16();
    const type = tiffReader.readUInt16();
    const count = tiffReader.readUInt32();
    const valueOffset = tiffReader.readUInt32();

    if (type === 5 && count === 1 && tag === EXIF_TAGS.X_RESOLUTION) {
      xResolution = readRational(tiffReader, valueOffset + tiffStart) ?? xResolution;
    } else if (type === 5 && count === 1 && tag === EXIF_TAGS.Y_RESOLUTION) {
      yResolution = readRational(tiffReader, valueOffset + tiffStart) ?? yResolution;
    } else if (type === 3 && count === 1 && tag === EXIF_TAGS.RESOLUTION_UNIT) {
      // A SHORT with count 1 is stored in the first 2 bytes of the value field
      resolutionUnit = isLittleEndian ? valueOffset & 0xffff : valueOffset >>> 16;
    }
  }

  if (!xResolution || !yResolution) {
    return {};
  }

  // Unit 3 is centimetres, unit 2 is inches; anything else is unitless
  if (resolutionUnit === 3) {
    return {
      wResolution: Math.round(xResolution * CM_PER_INCH),
      hResolution: Math.round(yResolution * CM_PER_INCH),
    };
  }

  if (resolutionUnit === 2) {
    return { wResolution: Math.round(xResolution), hResolution: Math.round(yResolution) };
  }

  return {};
}

/**
 * Parse JPEG image format
 */
export function parseJPEG(buffer: Buffer): ParseResult | null {
  if (buffer.length < 4) {
    return null;
  }

  const reader = new BufferReader(buffer); // JPEG uses big-endian

  // Check JPEG SOI marker
  if (reader.readUInt16() !== MARKERS.SOI) {
    return null;
  }

  let wResolution: number | undefined;
  let hResolution: number | undefined;
  let colorSpace: string | undefined;
  let iccProfile: string | undefined;

  while (reader.remaining() > 1) {
    // Find next marker
    if (reader.readUInt8() !== 0xff) {
      continue;
    }

    // Read marker byte
    const markerByte = reader.readUInt8();
    const marker = 0xff00 | markerByte;

    // Check for SOI or standalone markers
    if (marker === MARKERS.SOI || marker === MARKERS.EOI) {
      continue;
    }

    // Check if we have enough data for segment length
    if (!reader.canRead(2)) {
      break;
    }

    const segmentLength = reader.readUInt16();

    // Validate segment length
    if (segmentLength < 2 || !reader.canRead(segmentLength - 2)) {
      break;
    }

    const segmentStart = reader.getPosition();

    // Parse JFIF segment for resolution
    if (marker === MARKERS.APP0) {
      const resolution = parseJFIF(reader);
      // Only use JFIF resolution if we haven't found EXIF resolution yet
      if (wResolution === undefined) {
        wResolution = resolution.wResolution;
        hResolution = resolution.hResolution;
      }
    }

    // Parse EXIF segment for resolution (prefer EXIF over JFIF)
    if (marker === MARKERS.APP1) {
      const resolution = parseEXIF(reader);
      // EXIF resolution takes precedence over JFIF
      if (resolution.wResolution !== undefined) {
        wResolution = resolution.wResolution;
        hResolution = resolution.hResolution;
      }
    }

    // Parse APP2 for ICC profile
    if (marker === MARKERS.APP2 && segmentLength > 14) {
      // Check for ICC_PROFILE marker
      const iccMarker = reader.readString(12, 'latin1');
      if (iccMarker.startsWith('ICC_PROFILE\0')) {
        // ICC profiles can be chunked across multiple APP2 segments
        // For now, we'll just note that an ICC profile is present
        // Full ICC profile parsing would require assembling all chunks

        iccProfile ??= 'Embedded';

        // Skip chunk number and total chunks
        reader.skip(2);

        // Try to determine color space from the partial ICC data we have
        const profileDataLength = segmentLength - 18;
        if (profileDataLength > 0 && reader.canRead(profileDataLength)) {
          const profileData = reader.readBytes(profileDataLength);

          // Look for common profile name patterns in the available data
          const dataStr = profileData.toString('latin1');
          const detectedColorSpace = getColorSpaceFromString(dataStr);

          if (detectedColorSpace) {
            colorSpace = detectedColorSpace;
            iccProfile = detectedColorSpace;
          }

          // If we haven't determined the color space yet, try to get it from the ICC header
          if (!colorSpace && profileData.length >= 20) {
            // In the first chunk, bytes 16-20 contain the color space
            const colorSpaceTag = profileData.subarray(16, 20).toString('ascii');
            const tagColorSpace = getColorSpaceFromTag(colorSpaceTag);
            if (tagColorSpace) {
              colorSpace = tagColorSpace;
            }
          }
        }
      } else {
        // Rewind if not ICC profile
        reader.seek(segmentStart);
      }
    }

    // Parse APP14 for Adobe color transform
    if (marker === MARKERS.APP14 && segmentLength >= 12) {
      const adobeMarker = reader.readString(5, 'latin1');
      if (adobeMarker === 'Adobe') {
        reader.skip(6); // Skip version and flags
        const transform = reader.readUInt8();
        // 0 = Unknown (RGB or CMYK), 1 = YCbCr, 2 = YCCK
        // Only set color space from Adobe segment if we haven't determined it from ICC
        if (!colorSpace || colorSpace === 'RGB') {
          if (transform === 0) {
            // If no ICC profile was found, this might be Adobe RGB
            if (!iccProfile) {
              colorSpace = 'Adobe RGB';
            }
          } else if (transform === 1) {
            // YCbCr is the internal JPEG color space, but if we have an ICC profile,
            // the actual color space is defined by the profile
            if (!iccProfile) {
              colorSpace = 'YCbCr';
            }
          } else if (transform === 2) {
            colorSpace = 'YCCK';
          }
        }
      } else {
        // Rewind if not Adobe marker
        reader.seek(segmentStart);
      }
    }

    // Check for Start of Frame marker
    if (isSOFMarker(marker)) {
      // SOF segment: [precision:1] [height:2] [width:2] [components:1] ...
      if (!reader.canRead(6)) {
        break;
      }

      const precision = reader.readUInt8(); // Bits per sample
      const height = reader.readUInt16();
      const width = reader.readUInt16();
      const components = reader.readUInt8(); // Number of components

      if (width > 0 && height > 0) {
        // Infer color space from the component count if nothing else set it
        if (components && !colorSpace) {
          colorSpace = COLOR_SPACE_BY_COMPONENTS[components];
        }

        return {
          width,
          height,
          type: 'jpg',
          mime: 'image/jpeg',
          wUnits: 'px',
          hUnits: 'px',
          ...defined({
            // Zero precision or component count means the SOF header is malformed
            bitDepth: precision > 0 ? precision : undefined,
            channels: components > 0 ? components : undefined,
            wResolution,
            hResolution,
            colorSpace,
            iccProfile,
          }),
        };
      }
    }

    // Move to next segment
    reader.seek(segmentStart + segmentLength - 2);
  }

  return null;
}
