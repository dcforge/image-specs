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
 * Convert various units to pixels (rough approximation)
 */
function convertToPixels(value: number, unit: string): number {
  switch (unit) {
    case 'px':
    case '':
      return value;
    case 'in':
      return value * 96; // 96 DPI
    case 'cm':
      return value * 37.8; // ~96 DPI
    case 'mm':
      return value * 3.78; // ~96 DPI
    case 'pt':
      return value * 1.33; // 72 pt = 96 px
    case 'pc':
      return value * 16; // 1 pc = 12 pt
    case 'em':
    case 'rem':
      return value * 16; // Assume 16px base font size
    case 'ex':
      return value * 8; // Rough approximation
    default:
      return value; // Fallback to treating as pixels
  }
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

  let width: number | undefined;
  let height: number | undefined;
  let wUnits = 'px';
  let hUnits = 'px';

  // Parse width and height attributes
  if (widthMatch?.[1]) {
    const widthDim = parseDimension(widthMatch[1]);
    if (widthDim) {
      width = convertToPixels(widthDim.value, widthDim.unit);
      wUnits = widthDim.unit === '' ? 'px' : widthDim.unit;
    }
  }

  if (heightMatch?.[1]) {
    const heightDim = parseDimension(heightMatch[1]);
    if (heightDim) {
      height = convertToPixels(heightDim.value, heightDim.unit);
      hUnits = heightDim.unit === '' ? 'px' : heightDim.unit;
    }
  }

  // Fall back to viewBox if width/height not found
  if ((width === undefined || height === undefined) && viewBoxMatch?.[1]) {
    const viewBoxDims = parseViewBox(viewBoxMatch[1]);
    if (viewBoxDims) {
      width = width ?? viewBoxDims.width;
      height = height ?? viewBoxDims.height;
      wUnits = 'px';
      hUnits = 'px';
    }
  }

  // Default dimensions if nothing found
  if (width === undefined || height === undefined) {
    width = width ?? 300; // SVG default width
    height = height ?? 150; // SVG default height
  }

  if (width > 0 && height > 0) {
    return {
      width: Math.round(width),
      height: Math.round(height),
      type: 'svg',
      mime: 'image/svg+xml',
      wUnits,
      hUnits,
    };
  }

  return null;
}
