import { type Readable } from 'stream';

/**
 * Package metadata, replaced at build time by tsup (and by vitest when running
 * tests). Reading package.json at runtime instead would resolve to the wrong
 * path in the CJS bundle and fail outright once the bundle is shipped without
 * its manifest.
 */
declare const __PACKAGE_NAME__: string;
declare const __PACKAGE_VERSION__: string;

export const PACKAGE_NAME = __PACKAGE_NAME__;
export const PACKAGE_VERSION = __PACKAGE_VERSION__;

/**
 * Image specifications extracted from an image file
 */
export interface ImageSpecs {
  /** Image width in pixels or specified units */
  width: number;
  /** Image height in pixels or specified units */
  height: number;
  /** Image format type (e.g., 'jpg', 'png', 'gif') */
  type: string;
  /** MIME type (e.g., 'image/jpeg', 'image/png') */
  mime: string;
  /** Width units (e.g., 'px', 'in', 'cm') */
  wUnits: string;
  /** Height units (e.g., 'px', 'in', 'cm') */
  hUnits: string;
  /** Width resolution in DPI/PPI */
  wResolution?: number;
  /** Height resolution in DPI/PPI */
  hResolution?: number;
  /** Original URL if provided */
  url?: string;
  /** File path if provided */
  path?: string;
  /** Filename extracted from path or URL */
  filename?: string;
  /** Color space (e.g., 'sRGB', 'Adobe RGB', 'Display P3') */
  colorSpace?: string;
  /** ICC profile name if embedded */
  iccProfile?: string;
  /** Gamma value if specified */
  gamma?: number;
  /** Bit depth per channel */
  bitDepth?: number;
  /** Number of color channels */
  channels?: number;
}

/**
 * Options for extracting image specifications
 */
export interface ImageSpecsOptions {
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** HTTP headers to include in requests */
  headers?: Record<string, string>;
  /** Maximum number of bytes to read from stream (default: 64KB) */
  maxBytes?: number;
  /** User agent string for HTTP requests */
  userAgent?: string;
}

/**
 * Parser result containing image dimensions and metadata
 */
export interface ParseResult {
  /** Image width */
  width: number;
  /** Image height */
  height: number;
  /** Image format type */
  type: string;
  /** MIME type */
  mime: string;
  /** Width units (default: 'px') */
  wUnits?: string;
  /** Height units (default: 'px') */
  hUnits?: string;
  /** Width resolution in DPI/PPI */
  wResolution?: number;
  /** Height resolution in DPI/PPI */
  hResolution?: number;
  /** Color space */
  colorSpace?: string;
  /** ICC profile name */
  iccProfile?: string;
  /** Gamma value */
  gamma?: number;
  /** Bit depth per channel */
  bitDepth?: number;
  /** Number of color channels */
  channels?: number;
}

/**
 * Every key optional, with `undefined` removed from each value type
 */
type Defined<T> = { [K in keyof T]?: Exclude<T[K], undefined> };

/**
 * Drop keys whose value is `undefined`.
 *
 * `exactOptionalPropertyTypes` rejects an explicit `undefined` on an optional
 * property, so optional metadata is collected in one object literal and spread
 * through this helper instead of being assigned key by key.
 */
export function defined<T extends object>(obj: T): Defined<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as Defined<T>;
}

/**
 * Parser function signature
 */
export type Parser = (buffer: Buffer) => ParseResult | null;

/**
 * Input source type - can be URL string, Buffer, or Readable stream
 */
export type ImageSource = string | Buffer | Readable;

/**
 * Error types that can occur during image processing
 */
export class ImageSpecsError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'ImageSpecsError';
    this.code = code;
  }
}

/**
 * Specific error codes for different failure scenarios
 */
export const ErrorCodes = Object.freeze({
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  INVALID_URL: 'INVALID_URL',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  CORRUPTED_IMAGE: 'CORRUPTED_IMAGE',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
  INVALID_STREAM: 'INVALID_STREAM',
} as const);

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Default options for image specifications extraction
 */
export const DEFAULT_OPTIONS: Required<ImageSpecsOptions> = {
  timeout: 10000,
  headers: {},
  maxBytes: 65536, // 64KB
  userAgent: `image-specs/${PACKAGE_VERSION}`,
};
