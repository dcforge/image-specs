import { parseJPEG } from './jpeg.js';
import { parsePNG } from './png.js';
import { parseGIF } from './gif.js';
import { parseWebP } from './webp.js';
import { parseBMP } from './bmp.js';
import { parseSVG } from './svg.js';
import { parseAVIF } from './avif.js';
import { parseICO } from './ico.js';
import type { ParseResult } from '../types.js';
import { detectFormat, getAllParsers } from '../utils/detector.js';

/**
 * Parse image using efficient format detection
 * First attempts to detect the format, then uses the appropriate parser
 * Falls back to trying all parsers if detection fails
 */
export function parseImage(buffer: Buffer): ParseResult | null {
  const detected = detectFormat(buffer);

  // Detection only sniffs a short prefix, so fall back to every parser for
  // files whose marker sits outside that window (e.g. an SVG preceded by more
  // than a kilobyte of comments)
  const candidates = detected ? [detected, ...getAllParsers()] : getAllParsers();

  for (const parse of candidates) {
    try {
      const result = parse(buffer);
      if (result) {
        return result;
      }
    } catch {
      // Try the next parser
    }
  }

  return null;
}

// Re-export individual parsers
export { parseJPEG, parsePNG, parseGIF, parseWebP, parseBMP, parseSVG, parseAVIF, parseICO };
