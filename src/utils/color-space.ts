/**
 * Common color space utilities
 */

/**
 * Determine color space from ICC profile name or data string
 */
export function getColorSpaceFromString(str: string): string | undefined {
  const lowerStr = str.toLowerCase();

  if (lowerStr.includes('srgb') || lowerStr.includes('s_rgb')) {
    return 'sRGB';
  } else if (lowerStr.includes('adobe') && lowerStr.includes('rgb')) {
    return 'Adobe RGB';
  } else if (lowerStr.includes('display') && lowerStr.includes('p3')) {
    return 'Display P3';
  } else if (lowerStr.includes('prophoto')) {
    return 'ProPhoto RGB';
  } else if (
    lowerStr.includes('rec2020') ||
    lowerStr.includes('rec.2020') ||
    lowerStr.includes('rec_2020')
  ) {
    return 'Rec. 2020';
  }

  return undefined;
}

/**
 * Determine color space from ICC color space tag (4-byte string)
 */
export function getColorSpaceFromTag(tag: string): string | undefined {
  const trimmedTag = tag.trim();

  switch (trimmedTag) {
    case 'RGB':
      return 'RGB';
    case 'GRAY':
      return 'Grayscale';
    case 'CMYK':
      return 'CMYK';
    case 'Lab':
      return 'Lab';
    default:
      return undefined;
  }
}
