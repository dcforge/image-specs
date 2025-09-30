/**
 * Common utilities for image parsing
 */

/**
 * Calculate channels from PNG color type
 */
export function getPNGChannels(colorType: number): number {
  switch (colorType) {
    case 0: // Grayscale
      return 1;
    case 2: // RGB
      return 3;
    case 3: // Palette
      return 1;
    case 4: // Grayscale + Alpha
      return 2;
    case 6: // RGBA
      return 4;
    default:
      return 3;
  }
}