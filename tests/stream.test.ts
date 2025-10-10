import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'stream';
import { readStreamWithTimeout, toReadableStream, isValidStream } from '../src/stream.js';
import { ImageSpecsError, ErrorCodes } from '../src/types.js';

describe('Stream Utilities', () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.useFakeTimers();
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
  });

  describe('toReadableStream', () => {
    it('should return readable stream as-is', () => {
      const stream = new Readable();
      const result = toReadableStream(stream);
      expect(result).toBe(stream);
    });

    it('should convert buffer to readable stream', async () => {
      const buffer = Buffer.from('Test data');
      const stream = toReadableStream(buffer);

      expect(stream).toBeInstanceOf(Readable);

      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));

      await new Promise<void>((resolve) => {
        stream.on('end', resolve);
      });

      const result = Buffer.concat(chunks);
      expect(result).toEqual(buffer);
    });

    it('should handle data URLs', async () => {
      const originalData = Buffer.from('Hello World');
      const dataUrl = `data:text/plain;base64,${originalData.toString('base64')}`;

      const stream = toReadableStream(dataUrl);
      const chunks: Buffer[] = [];

      stream.on('data', (chunk) => chunks.push(chunk));

      await new Promise<void>((resolve) => {
        stream.on('end', resolve);
      });

      const result = Buffer.concat(chunks);
      expect(result).toEqual(originalData);
    });

    it('should throw error for invalid data URL', () => {
      const invalidDataUrl = 'data:invalid';
      expect(() => toReadableStream(invalidDataUrl)).toThrow(ImageSpecsError);
    });

    it('should throw error for regular URLs', () => {
      expect(() => toReadableStream('https://example.com')).toThrow(ImageSpecsError);
    });

    it('should throw error for unsupported types', () => {
      expect(() => toReadableStream(123 as any)).toThrow(ImageSpecsError);
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
