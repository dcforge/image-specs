import { type Readable } from 'stream';
import { basename } from 'path';
import { parseImage } from './parsers/index.js';
import { detectFormat } from './utils/detector.js';
import { fetchImageHeaders } from './http.js';
import { readStreamWithTimeout, toReadableStream, isValidStream } from './stream.js';
import {
  ImageSpecsError,
  ErrorCodes,
  DEFAULT_OPTIONS,
  type ImageSpecs,
  type ImageSpecsOptions,
  type ImageSource,
} from './types.js';

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
        // Extract filename from path using proper path utilities
        filename = basename(source) || undefined;
        // Read the file
        const { readFile } = await import('fs/promises');
        const buffer = await readFile(source);
        stream = toReadableStream(buffer);
      }
    } else if (Buffer.isBuffer(source)) {
      stream = toReadableStream(source);
    } else if (isValidStream(source)) {
      stream = source;
    } else {
      throw new ImageSpecsError('Invalid source type', ErrorCodes.INVALID_STREAM);
    }

    // Read data from stream
    let buffer = await readStreamWithTimeout(stream, opts.maxBytes, opts.timeout);

    if (buffer.length === 0) {
      throw new ImageSpecsError('No data received', ErrorCodes.INSUFFICIENT_DATA);
    }

    // Parse image
    let parseResult = parseImage(buffer);

    // If parsing failed and we have a URL source, try fetching more data
    // This handles cases where metadata blocks are very large (e.g., Photoshop data)
    const currentMaxBytes = opts.maxBytes ?? DEFAULT_OPTIONS.maxBytes;
    if (!parseResult && url && buffer.length === currentMaxBytes) {
      // Try with progressively larger buffers (up to 1MB)
      const maxRetries = 3;
      const increments = [currentMaxBytes * 2, currentMaxBytes * 4, 1048576]; // 128KB, 256KB, 1MB

      for (let i = 0; i < maxRetries && !parseResult; i++) {
        try {
          const newMaxBytes = increments[i];
          if (newMaxBytes === undefined) continue;

          const retryTimeout: number = opts.timeout ?? DEFAULT_OPTIONS.timeout;
          const retryOpts: ImageSpecsOptions = {
            timeout: retryTimeout,
            maxBytes: newMaxBytes,
            headers: opts.headers,
            userAgent: opts.userAgent,
          };
          const response = await fetchImageHeaders(url, retryOpts);
          buffer = await readStreamWithTimeout(response.stream, newMaxBytes, retryTimeout);
          parseResult = parseImage(buffer);
        } catch (_error) {
          // If retry fails, continue to next increment or give up
          if (i === maxRetries - 1) {
            throw new ImageSpecsError(
              'Unsupported or corrupted image format',
              ErrorCodes.UNSUPPORTED_FORMAT
            );
          }
        }
      }
    }

    if (!parseResult) {
      throw new ImageSpecsError(
        'Unsupported or corrupted image format',
        ErrorCodes.UNSUPPORTED_FORMAT
      );
    }

    // Build final result
    const result: ImageSpecs = {
      width: parseResult.width,
      height: parseResult.height,
      type: parseResult.type,
      mime: parseResult.mime,
      wUnits: parseResult.wUnits ?? 'px',
      hUnits: parseResult.hUnits ?? 'px',
    };

    // Add optional properties
    if (parseResult.wResolution !== undefined) {
      result.wResolution = parseResult.wResolution;
    }
    if (parseResult.hResolution !== undefined) {
      result.hResolution = parseResult.hResolution;
    }
    if (parseResult.colorSpace !== undefined) {
      result.colorSpace = parseResult.colorSpace;
    }
    if (parseResult.iccProfile !== undefined) {
      result.iccProfile = parseResult.iccProfile;
    }
    if (parseResult.gamma !== undefined) {
      result.gamma = parseResult.gamma;
    }
    if (parseResult.bitDepth !== undefined) {
      result.bitDepth = parseResult.bitDepth;
    }
    if (parseResult.channels !== undefined) {
      result.channels = parseResult.channels;
    }
    if (url !== undefined) {
      result.url = url;
    }
    if (path !== undefined) {
      result.path = path;
    }
    if (filename !== undefined) {
      result.filename = filename;
    }

    return result;
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
  try {
    // For buffers, use format detection
    if (Buffer.isBuffer(source)) {
      return detectFormat(source) !== null;
    }

    // For streams, peek at the first few bytes
    if (isValidStream(source)) {
      const buffer = await readStreamWithTimeout(
        source,
        1024,
        options.timeout ?? DEFAULT_OPTIONS.timeout
      );
      return detectFormat(buffer) !== null;
    }

    // For URLs and file paths
    if (typeof source === 'string') {
      if (source.startsWith('data:')) {
        const stream = toReadableStream(source);
        const buffer = await readStreamWithTimeout(
          stream,
          1024,
          options.timeout ?? DEFAULT_OPTIONS.timeout
        );
        return detectFormat(buffer) !== null;
      }

      // For HTTP/HTTPS URLs
      if (source.startsWith('http://') || source.startsWith('https://')) {
        try {
          const { fetchImageHeaders } = await import('./http.js');
          const response = await fetchImageHeaders(source, { ...options, maxBytes: 1024 });
          const buffer = await readStreamWithTimeout(
            response.stream,
            1024,
            options.timeout ?? DEFAULT_OPTIONS.timeout
          );
          return detectFormat(buffer) !== null;
        } catch {
          return false;
        }
      }

      // For file paths
      try {
        const { readFile } = await import('fs/promises');
        const buffer = await readFile(source);
        return detectFormat(buffer.subarray(0, 1024)) !== null;
      } catch {
        return false;
      }
    }

    return false;
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
  ImageFormat,
  ErrorCode,
} from './types.js';

export { ImageSpecsError, ErrorCodes, DEFAULT_OPTIONS, SUPPORTED_FORMATS } from './types.js';

export { parseImage } from './parsers/index.js';

// Export detector utilities for advanced usage
export { detectFormat, getImageType, mightBeImage } from './utils/detector.js';

// Default export for CommonJS compatibility
export default getImageSpecs;
