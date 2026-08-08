/**
 * Common color space utilities
 */
import { defined } from '../types.js';

/**
 * Color space hints, matched in order against a lowercased profile string
 */
const COLOR_SPACES: readonly { match: (str: string) => boolean; name: string }[] = [
  { match: (s) => s.includes('srgb') || s.includes('s_rgb'), name: 'sRGB' },
  { match: (s) => s.includes('adobe') && s.includes('rgb'), name: 'Adobe RGB' },
  { match: (s) => s.includes('display') && s.includes('p3'), name: 'Display P3' },
  { match: (s) => s.includes('prophoto'), name: 'ProPhoto RGB' },
  {
    match: (s) => ['rec2020', 'rec.2020', 'rec_2020'].some((tag) => s.includes(tag)),
    name: 'Rec. 2020',
  },
];

/**
 * ICC color space tags (4-byte strings) mapped to display names
 */
const COLOR_SPACE_TAGS: Record<string, string> = {
  RGB: 'RGB',
  GRAY: 'Grayscale',
  CMYK: 'CMYK',
  Lab: 'Lab',
};

/**
 * Well-known ICC profile descriptions and the color space each implies
 */
const ICC_PROFILES: readonly { pattern: RegExp; name: string; colorSpace: string }[] = [
  { pattern: /Adobe RGB \(1998\)/, name: 'Adobe RGB (1998)', colorSpace: 'Adobe RGB' },
  { pattern: /sRGB IEC61966-2\.1/, name: 'sRGB IEC61966-2.1', colorSpace: 'sRGB' },
  { pattern: /Display P3/, name: 'Display P3', colorSpace: 'Display P3' },
  { pattern: /ProPhoto RGB/, name: 'ProPhoto RGB', colorSpace: 'ProPhoto RGB' },
  { pattern: /Rec\. 2020/, name: 'Rec. 2020', colorSpace: 'Rec. 2020' },
  { pattern: /DCI-P3/, name: 'DCI-P3', colorSpace: 'DCI-P3' },
];

/** Signature of the ICC `desc` (text description) record: 'desc' as big-endian uint32 */
const ICC_DESC_TYPE = 0x64657363;

/** How far into a profile to scan for a recognisable name */
const ICC_SCAN_LIMIT = 512;

/**
 * Determine color space from ICC profile name or data string
 */
export function getColorSpaceFromString(str: string): string | undefined {
  const lower = str.toLowerCase();
  return COLOR_SPACES.find(({ match }) => match(lower))?.name;
}

/**
 * Determine color space from ICC color space tag (4-byte string)
 */
export function getColorSpaceFromTag(tag: string): string | undefined {
  return COLOR_SPACE_TAGS[tag.trim()];
}

/**
 * Read the human-readable description embedded in a raw ICC profile.
 *
 * The tagged element table points at a `desc` record laid out as:
 * type signature (4 bytes), reserved (4 bytes), ASCII length (4 bytes),
 * then the null-terminated name.
 */
function readIccDescription(profile: Buffer): string | undefined {
  const tagIndex = profile.indexOf(Buffer.from('desc', 'ascii'));
  if (tagIndex <= 0 || tagIndex + 12 >= profile.length) {
    return undefined;
  }

  const offset = profile.readUInt32BE(tagIndex + 4);
  const size = profile.readUInt32BE(tagIndex + 8);
  if (size === 0 || offset + 12 >= profile.length) {
    return undefined;
  }

  if (profile.readUInt32BE(offset) !== ICC_DESC_TYPE) {
    return undefined;
  }

  const length = profile.readUInt32BE(offset + 8);
  if (length === 0 || offset + 12 + length > profile.length) {
    return undefined;
  }

  const name = profile
    .subarray(offset + 12, offset + 12 + length)
    .toString('ascii')
    .replace(/\0/g, '')
    .trim();

  return name || undefined;
}

/**
 * Identify an embedded ICC profile from its raw bytes, preferring the
 * profile's own description and falling back to well-known profile names
 */
export function identifyIccProfile(profile: Buffer): { iccProfile?: string; colorSpace?: string } {
  const description = readIccDescription(profile);
  const text = profile
    .toString('ascii', 0, Math.min(profile.length, ICC_SCAN_LIMIT))
    .replace(/\0/g, ' ');
  const known = ICC_PROFILES.find(({ pattern }) => pattern.test(text));

  const iccProfile = description ?? known?.name;
  const colorSpace =
    known?.colorSpace ?? (iccProfile ? getColorSpaceFromString(iccProfile) : undefined);

  return defined({ iccProfile, colorSpace });
}
