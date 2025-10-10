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
  // First, try to detect the format and use the specific parser
  const detectedParser = detectFormat(buffer);
  if (detectedParser) {
    try {
      const result = detectedParser(buffer);
      if (result) {
        return result;
      }
    } catch {
      // If detected parser fails, continue with fallback
    }
  }

  // Fallback: try all parsers (for edge cases where detection might fail)
  const allParsers = getAllParsers();
  for (const parser of allParsers) {
    // Skip the already tried parser
    if (parser === detectedParser) continue;

    try {
      const result = parser(buffer);
      if (result) {
        return result;
      }
    } catch {
      // Continue with next parser if current one fails
      continue;
    }
  }
  return null;
}

// Re-export individual parsers
export { parseJPEG, parsePNG, parseGIF, parseWebP, parseBMP, parseSVG, parseAVIF, parseICO };
