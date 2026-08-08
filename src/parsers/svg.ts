import type { ParseResult } from '../types.js';

/**
 * Parse SVG viewBox attribute
 */
function parseViewBox(viewBox: string): { width: number; height: number } | null {
  const values = viewBox
    .trim()
    .split(/\s+|,/)
    .map((v) => parseFloat(v));
  if (values.length === 4 && values.every((v) => !isNaN(v))) {
    const width = values[2];
    const height = values[3];
    if (width !== undefined && height !== undefined) {
      return { width, height };
    }
  }
  return null;
}

/**
 * Parse dimension string (e.g., "100px", "50%", "2em")
 */
function parseDimension(dimension: string): { value: number; unit: string } | null {
  const match = /^([0-9]*\.?[0-9]+)(.*)?$/.exec(dimension.trim());
  if (match?.[1]) {
    const value = parseFloat(match[1]);
    const unit = match[2]?.trim() ?? 'px';
    return { value, unit };
  }
  return null;
}

/**
 * Pixels per unit at 96 DPI, assuming a 16px base font size.
 * Unlisted units (including 'px' and '') are treated as pixels.
 */
const PIXELS_PER_UNIT: Record<string, number> = {
  in: 96,
  cm: 37.8,
  mm: 3.78,
  pt: 1.33, // 72 pt = 96 px
  pc: 16, // 1 pc = 12 pt
  em: 16,
  rem: 16,
  ex: 8, // Rough approximation
};

/**
 * Convert various units to pixels (rough approximation)
 */
function convertToPixels(value: number, unit: string): number {
  return value * (PIXELS_PER_UNIT[unit] ?? 1);
}

/**
 * Resolve a raw width/height attribute to pixels and its reported unit
 */
function readDimension(raw: string | undefined): { pixels: number; unit: string } | undefined {
  const dimension = raw ? parseDimension(raw) : null;
  if (!dimension) {
    return undefined;
  }

  return {
    pixels: convertToPixels(dimension.value, dimension.unit),
    unit: dimension.unit === '' ? 'px' : dimension.unit,
  };
}

/**
 * Parse SVG image format
 */
export function parseSVG(buffer: Buffer): ParseResult | null {
  if (buffer.length < 4) {
    return null;
  }

  const content = buffer.toString('utf8');

  // Basic SVG detection
  if (!content.includes('<svg')) {
    return null;
  }

  // Extract SVG opening tag
  const svgMatch = /<svg[^>]*>/i.exec(content);
  if (!svgMatch) {
    return null;
  }

  const svgTag = svgMatch[0];

  // Try to extract width and height attributes
  const widthMatch = /width\s*=\s*["']([^"']+)["']/i.exec(svgTag);
  const heightMatch = /height\s*=\s*["']([^"']+)["']/i.exec(svgTag);
  const viewBoxMatch = /viewBox\s*=\s*["']([^"']+)["']/i.exec(svgTag);

  const parsed = { width: readDimension(widthMatch?.[1]), height: readDimension(heightMatch?.[1]) };

  let width = parsed.width?.pixels;
  let height = parsed.height?.pixels;
  let wUnits = parsed.width?.unit ?? 'px';
  let hUnits = parsed.height?.unit ?? 'px';

  // Fall back to viewBox if width/height not found
  if ((width === undefined || height === undefined) && viewBoxMatch?.[1]) {
    const viewBoxDims = parseViewBox(viewBoxMatch[1]);
    if (viewBoxDims) {
      width ??= viewBoxDims.width;
      height ??= viewBoxDims.height;
      wUnits = 'px';
      hUnits = 'px';
    }
  }

  width ??= 300; // SVG default width
  height ??= 150; // SVG default height

  if (width <= 0 || height <= 0) {
    return null;
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
    type: 'svg',
    mime: 'image/svg+xml',
    wUnits,
    hUnits,
  };
}
