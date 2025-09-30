import { type Readable } from 'stream';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * Get package version dynamically
 */
function getPackageVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packageJson = JSON.parse(
      readFileSync(join(__dirname, '../package.json'), 'utf-8')
    ) as { version: string };
    return packageJson.version;
  } catch {
    // Fallback for environments where package.json is not accessible
    return '1.0.0';
  }
}

export const PACKAGE_VERSION = getPackageVersion();

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
 * Image format information
 */
export interface ImageFormat {
  /** File extension */
  ext: string;
  /** MIME type */
  mime: string;
  /** Magic bytes for format detection */
  signature: Buffer | Buffer[];
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

/**
 * Supported image formats with their signatures
 */
export const SUPPORTED_FORMATS: readonly ImageFormat[] = [
  {
    ext: 'jpg',
    mime: 'image/jpeg',
    signature: Buffer.from([0xff, 0xd8, 0xff]),
  },
  {
    ext: 'png',
    mime: 'image/png',
    signature: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    ext: 'gif',
    mime: 'image/gif',
    signature: [Buffer.from('GIF87a'), Buffer.from('GIF89a')],
  },
  {
    ext: 'webp',
    mime: 'image/webp',
    signature: Buffer.from('WEBP', 'ascii'),
  },
  {
    ext: 'bmp',
    mime: 'image/bmp',
    signature: Buffer.from([0x42, 0x4d]),
  },
  {
    ext: 'svg',
    mime: 'image/svg+xml',
    signature: Buffer.from('<svg'),
  },
  {
    ext: 'avif',
    mime: 'image/avif',
    signature: Buffer.from('ftypavif'),
  },
  {
    ext: 'ico',
    mime: 'image/x-icon',
    signature: Buffer.from([0x00, 0x00, 0x01, 0x00]),
  },
] as const;
