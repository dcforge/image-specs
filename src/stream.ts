import { Readable } from 'stream';
import { ImageSpecsError, ErrorCodes } from './types.js';

/**
 * Read data from stream with timeout support
 */
export async function readStreamWithTimeout(
  stream: Readable,
  maxBytes: number,
  timeoutMs: number
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalLength = 0;
    let timeoutId: NodeJS.Timeout | undefined;

    const cleanup = (): void => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      stream.removeListener('data', onData);
      stream.removeListener('end', onEnd);
      stream.removeListener('error', onError);
      // Resume stream to prevent hanging if paused
      if (stream.isPaused()) {
        stream.resume();
      }
    };

    const onData = (chunk: Buffer): void => {
      chunks.push(chunk);
      totalLength += chunk.length;

      // Stop reading if we've reached maxBytes
      if (totalLength >= maxBytes) {
        // Pause to prevent buffering excess data
        stream.pause();
        cleanup();
        const buffer = Buffer.concat(chunks);
        resolve(buffer.subarray(0, maxBytes));
      }
    };

    const onEnd = (): void => {
      cleanup();
      if (totalLength === 0) {
        reject(new ImageSpecsError('Stream ended without data', ErrorCodes.INSUFFICIENT_DATA));
      } else {
        resolve(Buffer.concat(chunks));
      }
    };

    const onError = (error: Error): void => {
      cleanup();
      reject(new ImageSpecsError(`Stream error: ${error.message}`, ErrorCodes.INVALID_STREAM));
    };

    const onTimeout = (): void => {
      cleanup();
      // Destroy stream on timeout to prevent hanging
      if (!stream.destroyed) {
        stream.destroy();
      }
      reject(new ImageSpecsError('Stream read timeout', ErrorCodes.TIMEOUT));
    };

    // Set up timeout
    timeoutId = setTimeout(onTimeout, timeoutMs);

    // Set up stream listeners
    stream.on('data', onData);
    stream.on('end', onEnd);
    stream.on('error', onError);
  });
}

/**
 * Convert various input types to a readable stream
 */
export function toReadableStream(input: string | Buffer | Readable): Readable {
  if (input instanceof Readable) {
    return input;
  }

  if (Buffer.isBuffer(input)) {
    return Readable.from(input);
  }

  if (typeof input === 'string') {
    // Handle data URLs
    if (input.startsWith('data:')) {
      try {
        const dataUrl = new URL(input);
        const base64Data = dataUrl.pathname.split(',')[1];
        if (base64Data) {
          const buffer = Buffer.from(base64Data, 'base64');
          return Readable.from(buffer);
        }
      } catch {
        throw new ImageSpecsError('Invalid data URL format', ErrorCodes.INVALID_URL);
      }
    }

    // For regular URLs, we need to use the HTTP utilities
    throw new ImageSpecsError('URL input requires HTTP fetching', ErrorCodes.INVALID_URL);
  }

  throw new ImageSpecsError('Unsupported input type', ErrorCodes.INVALID_STREAM);
}

/**
 * Check if a stream is readable and not destroyed
 */
export function isValidStream(stream: unknown): stream is Readable {
  return stream instanceof Readable && stream.readable && !stream.destroyed;
}
