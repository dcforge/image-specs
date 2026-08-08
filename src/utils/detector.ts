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
interface Detector {
  ext: string;
  parser: Parser;
  validate: (buffer: Buffer) => boolean;
}

/** How far into a text file to look for an SVG root element */
const SVG_SCAN_LIMIT = 1024;

/**
 * Check if buffer matches a signature at the given offset
 */
function matchesSignature(buffer: Buffer, signature: string | number[], offset = 0): boolean {
  const bytes = typeof signature === 'string' ? Buffer.from(signature, 'ascii') : signature;
  if (offset + bytes.length > buffer.length) {
    return false;
  }

  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

/**
 * AVIF is an ISOBMFF file whose ftyp box declares an 'avif' or 'avis' brand
 */
function isAVIF(buffer: Buffer): boolean {
  if (!matchesSignature(buffer, 'ftyp', 4)) {
    return false;
  }

  const brands = buffer.subarray(8, Math.min(buffer.length, 100)).toString('ascii');
  return brands.includes('avif') || brands.includes('avis');
}

/**
 * Detector registry, ordered by reliability: binary signatures first, and the
 * text-based SVG check last because it is the least precise
 */
const DETECTORS: readonly Detector[] = [
  { ext: 'jpg', parser: parseJPEG, validate: (b) => matchesSignature(b, [0xff, 0xd8]) },
  {
    ext: 'png',
    parser: parsePNG,
    validate: (b) => matchesSignature(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    ext: 'gif',
    parser: parseGIF,
    validate: (b) => matchesSignature(b, 'GIF87a') || matchesSignature(b, 'GIF89a'),
  },
  {
    ext: 'webp',
    parser: parseWebP,
    validate: (b) => matchesSignature(b, 'RIFF') && matchesSignature(b, 'WEBP', 8),
  },
  { ext: 'bmp', parser: parseBMP, validate: (b) => matchesSignature(b, 'BM') },
  {
    ext: 'ico',
    parser: parseICO,
    validate: (b) => matchesSignature(b, [0x00, 0x00, 0x01, 0x00]),
  },
  { ext: 'avif', parser: parseAVIF, validate: isAVIF },
  {
    ext: 'svg',
    parser: parseSVG,
    validate: (b) => {
      const head = b.subarray(0, SVG_SCAN_LIMIT).toString('utf8');
      return head.includes('<svg') || head.includes('<!DOCTYPE svg');
    },
  },
];

/**
 * Detect image format from buffer and return appropriate parser
 */
export function detectFormat(buffer: Buffer): Parser | null {
  return DETECTORS.find((detector) => detector.validate(buffer))?.parser ?? null;
}

/**
 * Get all parsers in order (for fallback)
 */
export function getAllParsers(): readonly Parser[] {
  return DETECTORS.map((detector) => detector.parser);
}

/**
 * Get image format type from buffer (without parsing)
 */
export function getImageType(buffer: Buffer): string | null {
  if (buffer.length < 2) {
    return null;
  }

  return DETECTORS.find((detector) => detector.validate(buffer))?.ext ?? null;
}
