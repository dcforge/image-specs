import { Readable } from 'stream';
import { ImageSpecsError, ErrorCodes } from './types.js';

/**
 * Read binary data from a stream up to maxBytes, failing if the read stalls.
 */
export async function readStreamWithTimeout(
  stream: Readable,
  maxBytes: number,
  timeoutMs: number
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let acceptedLength = 0;
  let reachedLimit = maxBytes <= 0;
  let timedOut = false;
  const timeoutError = new ImageSpecsError('Stream read timeout', ErrorCodes.TIMEOUT);
  const timeoutId = setTimeout(() => {
    timedOut = true;
    stream.destroy(timeoutError);
  }, timeoutMs);

  try {
    if (reachedLimit) {
      stream.destroy();
    } else {
      for await (const chunk of stream.iterator({ destroyOnReturn: false })) {
        if (!Buffer.isBuffer(chunk) && !(chunk instanceof Uint8Array)) {
          throw new TypeError('Expected binary data');
        }

        const buffer = Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
        const accepted = buffer.subarray(0, maxBytes - acceptedLength);
        if (accepted.length > 0) {
          chunks.push(accepted);
          acceptedLength += accepted.length;
        }

        if (acceptedLength >= maxBytes) {
          reachedLimit = true;
          stream.destroy();
          break;
        }
      }
    }
  } catch (error) {
    if (timedOut) {
      throw timeoutError;
    }
    if (!stream.destroyed) {
      stream.destroy();
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new ImageSpecsError(`Stream error: ${message}`, ErrorCodes.INVALID_STREAM);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!reachedLimit && stream.destroyed && !stream.readableEnded) {
    throw new ImageSpecsError('Stream error: Premature close', ErrorCodes.INVALID_STREAM);
  }
  if (acceptedLength === 0 && !reachedLimit) {
    throw new ImageSpecsError('Stream ended without data', ErrorCodes.INSUFFICIENT_DATA);
  }

  return Buffer.concat(chunks, acceptedLength);
}

/**
 * Check if a stream is readable and not destroyed
 */
export function isValidStream(stream: unknown): stream is Readable {
  return stream instanceof Readable && stream.readable && !stream.destroyed;
}
