import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'stream';
import { readStreamWithTimeout, isValidStream } from '../src/stream.js';
import { ImageSpecsError, ErrorCodes } from '../src/types.js';

describe('Stream Utilities', () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('readStreamWithTimeout', () => {
    it('should read data within timeout', async () => {
      const data = Buffer.from('Test data');
      const stream = Readable.from(data);

      const result = await readStreamWithTimeout(stream, 100, 1000);
      expect(result).toEqual(data);
    });

    it('should timeout when reading takes too long', async () => {
      const stream = new Readable({
        read() {
          // Never push data
        },
      });

      const promise = readStreamWithTimeout(stream, 100, 1000);
      vi.advanceTimersByTime(1001);

      await expect(promise).rejects.toThrow(ImageSpecsError);
      await expect(promise).rejects.toMatchObject({
        code: ErrorCodes.TIMEOUT,
      });
    });

    it('should limit bytes read', async () => {
      const data = Buffer.from('This is a long string of data');
      const stream = Readable.from(data);

      const result = await readStreamWithTimeout(stream, 10, 1000);
      expect(result).toEqual(Buffer.from('This is a '));
    });

    it('should stop pulling from the source once maxBytes is reached', async () => {
      const total = 2000;
      let produced = 0;
      const stream = new Readable({
        read() {
          if (produced >= total) {
            this.push(null);
            return;
          }
          produced += 100;
          this.push(Buffer.alloc(100, 0x61));
        },
      });

      const result = await readStreamWithTimeout(stream, 100, 1000);

      expect(result).toHaveLength(100);
      expect(stream.destroyed).toBe(true);
      // Node fills its internal buffer a little ahead of the first 'data'
      // event, but the source must not be drained to the end
      expect(produced).toBeLessThan(total);
    });

    it('should handle stream end', async () => {
      const data = Buffer.from('Short');
      const stream = Readable.from(data);

      const result = await readStreamWithTimeout(stream, 100, 1000);
      expect(result).toEqual(data);
    });

    it('should handle empty stream', async () => {
      const stream = new Readable({
        read() {
          this.push(null);
        },
      });

      await expect(readStreamWithTimeout(stream, 10, 1000)).rejects.toThrow(ImageSpecsError);
    });

    it('should accept Uint8Array chunks', async () => {
      const stream = Readable.from([Uint8Array.from([1, 2, 3])]);

      await expect(readStreamWithTimeout(stream, 10, 1000)).resolves.toEqual(
        Buffer.from([1, 2, 3])
      );
    });

    it('should reject non-binary chunks without throwing outside the promise', async () => {
      for (const chunks of [['text'], [{ value: 'object' }]]) {
        const stream = Readable.from(chunks);

        await expect(readStreamWithTimeout(stream, 10, 1000)).rejects.toMatchObject({
          code: ErrorCodes.INVALID_STREAM,
          message: 'Stream error: Expected binary data',
        });
        expect(stream.destroyed).toBe(true);
      }
    });

    it('should map source errors immediately', async () => {
      const stream = new Readable({
        read() {
          this.destroy(new Error('source failed'));
        },
      });

      await expect(readStreamWithTimeout(stream, 10, 1000)).rejects.toMatchObject({
        code: ErrorCodes.INVALID_STREAM,
        message: 'Stream error: source failed',
      });
    });

    it('should reject a premature close immediately', async () => {
      const stream = new Readable({
        read() {
          // Wait for the explicit close below.
        },
      });
      const result = readStreamWithTimeout(stream, 10, 1000);

      stream.destroy();

      await expect(result).rejects.toMatchObject({
        code: ErrorCodes.INVALID_STREAM,
        message: 'Stream error: Premature close',
      });
    });
  });

  describe('isValidStream', () => {
    it('should return true for readable stream', () => {
      const stream = new Readable();
      expect(isValidStream(stream)).toBe(true);
    });

    it('should return false for destroyed stream', () => {
      const stream = new Readable();
      stream.destroy();
      expect(isValidStream(stream)).toBe(false);
    });

    it('should return false for non-readable stream', () => {
      const stream = new Readable();
      stream.readable = false;
      expect(isValidStream(stream)).toBe(false);
    });

    it('should return false for non-stream objects', () => {
      expect(isValidStream({})).toBe(false);
      expect(isValidStream(null)).toBe(false);
      expect(isValidStream('string')).toBe(false);
    });
  });
});
