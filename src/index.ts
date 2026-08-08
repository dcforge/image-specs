import { type Readable } from 'stream';
import { readFile } from 'fs/promises';
import { basename } from 'path';
import { parseImage } from './parsers/index.js';
import { detectFormat } from './utils/detector.js';
import { fetchImageHeaders } from './http.js';
import { readStreamWithTimeout, toReadableStream, isValidStream } from './stream.js';
import {
  ImageSpecsError,
  ErrorCodes,
  DEFAULT_OPTIONS,
  defined,
  type ImageSpecs,
  type ImageSpecsOptions,
  type ImageSource,
} from './types.js';

/** Bytes of a source that need inspecting to recognise its format */
const DETECTION_BYTES = 1024;

/**
 * Extract image specifications from a URL, Buffer, or stream
 *
 * @param source - Image source (URL string, Buffer, or Readable stream)
 * @param options - Options for fetching and parsing
 * @returns Promise resolving to image specifications
 *
 * @example
 * ```typescript
 * // From URL
 * const specs = await getImageSpecs('https://example.com/image.jpg');
 *
 * // From Buffer
 * const buffer = fs.readFileSync('image.png');
 * const specs = await getImageSpecs(buffer);
 *
 * // From stream
 * const stream = fs.createReadStream('image.gif');
 * const specs = await getImageSpecs(stream);
 *
 * // With options
 * const specs = await getImageSpecs('https://example.com/image.webp', {
 *   timeout: 5000,
 *   headers: { 'User-Agent': 'my-app' }
 * });
 * ```
 */
export async function getImageSpecs(
  source: ImageSource,
  options: ImageSpecsOptions = {}
): Promise<ImageSpecs> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    let stream: Readable;
    let url: string | undefined;
    let path: string | undefined;
    let filename: string | undefined;

    // Handle different input types
    if (typeof source === 'string') {
      // Handle data URLs
      if (source.startsWith('data:')) {
        stream = toReadableStream(source);
      } else if (source.startsWith('http://') || source.startsWith('https://')) {
        // Handle HTTP/HTTPS URLs
        url = source;
        // Extract filename from URL
        try {
          const urlObj = new URL(source);
          const pathname = urlObj.pathname;
          if (pathname && pathname !== '/') {
            filename = basename(pathname) || undefined;
          }
        } catch (error) {
          // URL parsing should succeed here since we checked the protocol
          throw new ImageSpecsError(
            `Failed to parse URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
            ErrorCodes.INVALID_URL
          );
        }
        const response = await fetchImageHeaders(source, opts);
        stream = response.stream;
      } else {
        // Assume it's a file path
        path = source;
        filename = basename(source) || undefined;
        stream = toReadableStream(await readFile(source));
      }
    } else if (Buffer.isBuffer(source)) {
      stream = toReadableStream(source);
    } else if (isValidStream(source)) {
      stream = source;
    } else {
      throw new ImageSpecsError('Invalid source type', ErrorCodes.INVALID_STREAM);
    }

    // Read data from stream
    const buffer = await readStreamWithTimeout(stream, opts.maxBytes, opts.timeout);

    if (buffer.length === 0) {
      throw new ImageSpecsError('No data received', ErrorCodes.INSUFFICIENT_DATA);
    }

    // Parse image
    const parseResult = parseImage(buffer);

    if (!parseResult) {
      throw new ImageSpecsError(
        'Unsupported or corrupted image format',
        ErrorCodes.UNSUPPORTED_FORMAT
      );
    }

    const { wUnits, hUnits, width, height, type, mime, ...metadata } = parseResult;

    return {
      width,
      height,
      type,
      mime,
      wUnits: wUnits ?? 'px',
      hUnits: hUnits ?? 'px',
      ...defined({ ...metadata, url, path, filename }),
    };
  } catch (error) {
    if (error instanceof ImageSpecsError) {
      throw error;
    }

    // Wrap unknown errors
    throw new ImageSpecsError(
      `Failed to extract image specifications: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ErrorCodes.CORRUPTED_IMAGE
    );
  }
}

/**
 * Extract image specifications from multiple sources concurrently
 *
 * @param sources - Array of image sources
 * @param options - Options for fetching and parsing
 * @returns Promise resolving to array of results (successful extractions and errors)
 *
 * @example
 * ```typescript
 * const sources = [
 *   'https://example.com/image1.jpg',
 *   'https://example.com/image2.png',
 *   buffer,
 *   stream,
 * ];
 *
 * const results = await getImageSpecsBatch(sources);
 * results.forEach((result, index) => {
 *   if (result.success) {
 *     console.log(`Image ${index}: ${result.specs.width}x${result.specs.height}`);
 *   } else {
 *     console.error(`Image ${index} failed: ${result.error.message}`);
 *   }
 * });
 * ```
 */
export async function getImageSpecsBatch(
  sources: ImageSource[],
  options: ImageSpecsOptions = {}
): Promise<({ success: true; specs: ImageSpecs } | { success: false; error: ImageSpecsError })[]> {
  const promises = sources.map(async (source, index) => {
    try {
      const specs = await getImageSpecs(source, options);
      return { success: true as const, specs };
    } catch (error) {
      const imageError =
        error instanceof ImageSpecsError
          ? error
          : new ImageSpecsError(
              `Batch item ${index}: ${error instanceof Error ? error.message : 'Unknown error'}`,
              ErrorCodes.CORRUPTED_IMAGE
            );
      return { success: false as const, error: imageError };
    }
  });

  return Promise.all(promises);
}

/**
 * Check if a source appears to be a supported image format without fully parsing
 *
 * @param source - Image source to check
 * @param options - Options for fetching
 * @returns Promise resolving to true if the source might be a supported image
 *
 * @example
 * ```typescript
 * const isImage = await isImageSource('https://example.com/file.pdf');
 * if (isImage) {
 *   const specs = await getImageSpecs(url);
 * }
 * ```
 */
export async function isImageSource(
  source: ImageSource,
  options: ImageSpecsOptions = {}
): Promise<boolean> {
  const timeout = options.timeout ?? DEFAULT_OPTIONS.timeout;
  const peek = (stream: Readable): Promise<Buffer> =>
    readStreamWithTimeout(stream, DETECTION_BYTES, timeout);

  try {
    if (Buffer.isBuffer(source)) {
      return detectFormat(source) !== null;
    }

    if (isValidStream(source)) {
      return detectFormat(await peek(source)) !== null;
    }

    if (typeof source !== 'string') {
      return false;
    }

    if (source.startsWith('data:')) {
      return detectFormat(await peek(toReadableStream(source))) !== null;
    }

    if (source.startsWith('http://') || source.startsWith('https://')) {
      const response = await fetchImageHeaders(source, { ...options, maxBytes: DETECTION_BYTES });
      return detectFormat(await peek(response.stream)) !== null;
    }

    // Assume a file path
    const buffer = await readFile(source);
    return detectFormat(buffer.subarray(0, DETECTION_BYTES)) !== null;
  } catch {
    return false;
  }
}

// Re-export types and utilities
export type {
  ImageSpecs,
  ImageSpecsOptions,
  ImageSource,
  ParseResult,
  ErrorCode,
} from './types.js';

export { ImageSpecsError, ErrorCodes, DEFAULT_OPTIONS } from './types.js';

export { parseImage } from './parsers/index.js';

// Export detector utilities for advanced usage
export { detectFormat, getImageType } from './utils/detector.js';

// Default export for CommonJS compatibility
export default getImageSpecs;
