import type { Parser } from '../types.js';
import { parseJPEG } from '../parsers/jpeg.js';
import { parsePNG } from '../parsers/png.js';
import { parseGIF } from '../parsers/gif.js';
import { parseWebP } from '../parsers/webp.js';
import { parseBMP } from '../parsers/bmp.js';
import { parseSVG } from '../parsers/svg.js';
import { parseAVIF } from '../parsers/avif.js';
import { parseICO } from '../parsers/ico.js';

/**
 * Image format detector entry
 */
interface DetectorEntry {
  parser: Parser;
  validate: (buffer: Buffer) => boolean;
}

/**
 * Check if buffer matches signature at offset
 */
function matchesSignature(buffer: Buffer, signature: number[] | Buffer, offset = 0): boolean {
  if (offset + signature.length > buffer.length) {
    return false;
  }

  const sig = Array.isArray(signature) ? signature : Array.from(signature);

  for (let i = 0; i < sig.length; i++) {
    if (buffer[offset + i] !== sig[i]) {
      return false;
    }
  }

  return true;
}

/**
 * JPEG detector - checks for SOI marker (0xFFD8)
 */
const jpegDetector: DetectorEntry = {
  parser: parseJPEG,
  validate: (buffer: Buffer) => {
    return buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8;
  },
};

/**
 * PNG detector - checks for PNG signature
 */
const pngDetector: DetectorEntry = {
  parser: parsePNG,
  validate: (buffer: Buffer) => {
    return matchesSignature(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  },
};

/**
 * GIF detector - checks for GIF87a or GIF89a
 */
const gifDetector: DetectorEntry = {
  parser: parseGIF,
  validate: (buffer: Buffer) => {
    if (buffer.length < 6) return false;
    const sig = buffer.subarray(0, 6).toString('ascii');
    return sig === 'GIF87a' || sig === 'GIF89a';
  },
};

/**
 * WebP detector - checks for RIFF header with WEBP
 */
const webpDetector: DetectorEntry = {
  parser: parseWebP,
  validate: (buffer: Buffer) => {
    return (
      buffer.length >= 12 &&
      matchesSignature(buffer, Buffer.from('RIFF'), 0) &&
      matchesSignature(buffer, Buffer.from('WEBP'), 8)
    );
  },
};

/**
 * BMP detector - checks for BM signature
 */
const bmpDetector: DetectorEntry = {
  parser: parseBMP,
  validate: (buffer: Buffer) => {
    return (
      buffer.length >= 2 &&
      buffer[0] === 0x42 && // 'B'
      buffer[1] === 0x4d
    ); // 'M'
  },
};

/**
 * ICO detector - checks for ICO header (0x00 0x00 0x01 0x00)
 */
const icoDetector: DetectorEntry = {
  parser: parseICO,
  validate: (buffer: Buffer) => {
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x00 &&
      buffer[1] === 0x00 &&
      buffer[2] === 0x01 &&
      buffer[3] === 0x00
    );
  },
};

/**
 * AVIF detector - checks for ftyp box with AVIF brand
 */
const avifDetector: DetectorEntry = {
  parser: parseAVIF,
  validate: (buffer: Buffer) => {
    if (buffer.length < 12) return false;

    // Check for ftyp box at offset 4
    if (!matchesSignature(buffer, Buffer.from('ftyp'), 4)) {
      return false;
    }

    // Check for AVIF brand (major or compatible)
    const brandsSection = buffer.subarray(8, Math.min(buffer.length, 100));
    const brandsStr = brandsSection.toString('ascii');

    return brandsStr.includes('avif') || brandsStr.includes('avis');
  },
};

/**
 * SVG detector - checks for SVG or XML content
 * Note: SVG is checked last as it's text-based and less precise
 */
const svgDetector: DetectorEntry = {
  parser: parseSVG,
  validate: (buffer: Buffer) => {
    // SVG files might start with XML declaration or directly with <svg
    // We need to be careful not to match other XML files
    const str = buffer.subarray(0, Math.min(buffer.length, 1024)).toString('utf8');

    // Check for SVG-specific patterns
    if (str.includes('<svg')) return true;
    if (str.includes('<?xml') && str.includes('<svg')) return true;
    if (str.includes('<!DOCTYPE svg')) return true;

    return false;
  },
};

/**
 * Detector registry - ordered by reliability and frequency
 * Binary formats first, text formats last
 */
const detectors: readonly DetectorEntry[] = [
  jpegDetector,
  pngDetector,
  gifDetector,
  webpDetector,
  bmpDetector,
  icoDetector,
  avifDetector,
  svgDetector, // SVG last as it's least precise
];

/**
 * Detect image format from buffer and return appropriate parser
 */
export function detectFormat(buffer: Buffer): Parser | null {
  for (const detector of detectors) {
    if (detector.validate(buffer)) {
      return detector.parser;
    }
  }
  return null;
}

/**
 * Get all parsers in order (for fallback)
 */
export function getAllParsers(): readonly Parser[] {
  return detectors.map((d) => d.parser);
}

/**
 * Type guard to check if buffer might be an image
 */
export function mightBeImage(buffer: Buffer): boolean {
  if (buffer.length < 2) return false;

  // Quick check for common image format markers
  const firstByte = buffer[0];
  const secondByte = buffer[1];

  // Common first bytes of images
  switch (firstByte) {
    case 0xff: // JPEG
      return secondByte === 0xd8;
    case 0x89: // PNG
      return secondByte === 0x50;
    case 0x47: // GIF ('G')
      return secondByte === 0x49; // 'I'
    case 0x52: // RIFF/WebP ('R')
      return secondByte === 0x49; // 'I'
    case 0x42: // BMP ('B')
      return secondByte === 0x4d; // 'M'
    case 0x00: // ICO or AVIF
      return true; // Need more bytes to determine
    case 0x3c: // '<' - Possibly SVG
      return true;
    default:
      // Check for AVIF (starts with size + 'ftyp')
      if (buffer.length >= 8) {
        return matchesSignature(buffer, Buffer.from('ftyp'), 4);
      }
      return false;
  }
}

/**
 * Get image format type from buffer (without parsing)
 */
export function getImageType(buffer: Buffer): string | null {
  if (buffer.length < 2) return null;

  // Check each format in order
  if (jpegDetector.validate(buffer)) return 'jpg';
  if (pngDetector.validate(buffer)) return 'png';
  if (gifDetector.validate(buffer)) return 'gif';
  if (webpDetector.validate(buffer)) return 'webp';
  if (bmpDetector.validate(buffer)) return 'bmp';
  if (icoDetector.validate(buffer)) return 'ico';
  if (avifDetector.validate(buffer)) return 'avif';
  if (svgDetector.validate(buffer)) return 'svg';

  return null;
}
