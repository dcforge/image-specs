import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Readable } from 'stream';
import {
  getImageSpecs,
  getImageSpecsBatch,
  isImageSource,
  ImageSpecsError,
  ErrorCodes,
} from '../src/index.js';

// Mock the http module
vi.mock('../src/http.js', () => ({
  fetchImageHeaders: vi.fn(),
}));

// Mock stream utilities
vi.mock('../src/stream.js', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    readStreamWithTimeout: vi.fn((stream) => {
      // If stream is a Buffer or can be converted to one, return it
      if (Buffer.isBuffer(stream)) {
        return Promise.resolve(stream);
      }
      // For readable streams created from buffers, extract the buffer
      if (stream && typeof stream === 'object' && '_readableState' in stream) {
        const chunks: Buffer[] = [];
        return new Promise((resolve) => {
          stream.on('data', (chunk: Buffer) => chunks.push(chunk));
          stream.on('end', () => resolve(Buffer.concat(chunks)));
          stream.read();
        });
      }
      // Return empty buffer by default
      return Promise.resolve(Buffer.alloc(0));
    }),
  };
});

describe('Image Specs Main API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getImageSpecs', () => {
    it('should extract specs from Buffer', async () => {
      // Create a minimal valid PNG buffer
      const pngBuffer = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG signature
        Buffer.from([0x00, 0x00, 0x00, 0x0d]), // IHDR length
        Buffer.from('IHDR'), // IHDR type
        Buffer.from([0x00, 0x00, 0x01, 0x40]), // Width (320)
        Buffer.from([0x00, 0x00, 0x01, 0x00]), // Height (256)
        Buffer.from([0x08, 0x06, 0x00, 0x00, 0x00]), // IHDR data
        Buffer.alloc(4), // CRC
      ]);

      const result = await getImageSpecs(pngBuffer);
      expect(result).toMatchObject({
        width: 320,
        height: 256,
        type: 'png',
        mime: 'image/png',
        wUnits: 'px',
        hUnits: 'px',
      });
      // Check that new fields are present
      expect(result.bitDepth).toBe(8);
      expect(result.channels).toBe(4);
    });

    it('should extract specs from stream', async () => {
      const pngBuffer = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from([0x00, 0x00, 0x00, 0x0d]),
        Buffer.from('IHDR'),
        Buffer.from([0x00, 0x00, 0x01, 0x40]),
        Buffer.from([0x00, 0x00, 0x01, 0x00]),
        Buffer.from([0x08, 0x06, 0x00, 0x00, 0x00]),
        Buffer.alloc(4),
      ]);

      const stream = Readable.from(pngBuffer);
      const result = await getImageSpecs(stream);
      expect(result).toMatchObject({
        width: 320,
        height: 256,
        type: 'png',
        mime: 'image/png',
        wUnits: 'px',
        hUnits: 'px',
      });
    });

    it('should handle data URLs', async () => {
      // Create a data URL with PNG data
      const pngBuffer = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from([0x00, 0x00, 0x00, 0x0d]),
        Buffer.from('IHDR'),
        Buffer.from([0x00, 0x00, 0x01, 0x40]),
        Buffer.from([0x00, 0x00, 0x01, 0x00]),
        Buffer.from([0x08, 0x06, 0x00, 0x00, 0x00]),
        Buffer.alloc(4),
      ]);

      const dataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;
      const result = await getImageSpecs(dataUrl);
      expect(result).toMatchObject({
        width: 320,
        height: 256,
        type: 'png',
        mime: 'image/png',
        wUnits: 'px',
        hUnits: 'px',
      });
    });

    it('should throw error for unsupported format', async () => {
      const unsupportedBuffer = Buffer.from([0x12, 0x34, 0x56, 0x78]);

      await expect(getImageSpecs(unsupportedBuffer)).rejects.toThrow(ImageSpecsError);
      await expect(getImageSpecs(unsupportedBuffer)).rejects.toMatchObject({
        code: ErrorCodes.UNSUPPORTED_FORMAT,
      });
    });

    it('should throw error for empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);

      await expect(getImageSpecs(emptyBuffer)).rejects.toThrow(ImageSpecsError);
      await expect(getImageSpecs(emptyBuffer)).rejects.toMatchObject({
        code: ErrorCodes.INSUFFICIENT_DATA,
      });
    });

    it('should throw error for invalid input type', async () => {
      await expect(getImageSpecs(123 as any)).rejects.toThrow(ImageSpecsError);
      await expect(getImageSpecs(123 as any)).rejects.toMatchObject({
        code: ErrorCodes.INVALID_STREAM,
      });
    });

    it('should include URL in result when provided', async () => {
      const { fetchImageHeaders } = await import('../src/http.js');
      const { readStreamWithTimeout } = await import('../src/stream.js');

      const pngBuffer = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from([0x00, 0x00, 0x00, 0x0d]),
        Buffer.from('IHDR'),
        Buffer.from([0x00, 0x00, 0x01, 0x40]),
        Buffer.from([0x00, 0x00, 0x01, 0x00]),
        Buffer.from([0x08, 0x06, 0x00, 0x00, 0x00]),
        Buffer.alloc(4),
      ]);

      vi.mocked(fetchImageHeaders).mockResolvedValue({
        stream: Readable.from(pngBuffer),
        headers: {},
        statusCode: 200,
        url: 'https://example.com/image.png',
      });

      vi.mocked(readStreamWithTimeout).mockResolvedValue(pngBuffer);

      const result = await getImageSpecs('https://example.com/image.png');
      expect(result.url).toBe('https://example.com/image.png');
    });
  });

  describe('getImageSpecsBatch', () => {
    it('should process multiple sources', async () => {
      const pngBuffer = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from([0x00, 0x00, 0x00, 0x0d]),
        Buffer.from('IHDR'),
        Buffer.from([0x00, 0x00, 0x01, 0x40]),
        Buffer.from([0x00, 0x00, 0x01, 0x00]),
        Buffer.from([0x08, 0x06, 0x00, 0x00, 0x00]),
        Buffer.alloc(4),
      ]);

      const jpegBuffer = Buffer.concat([
        Buffer.from([0xff, 0xd8]),
        Buffer.from([0xff, 0xc0]),
        Buffer.from([0x00, 0x11]),
        Buffer.from([0x08]),
        Buffer.from([0x01, 0x00]),
        Buffer.from([0x01, 0x40]),
        Buffer.from([0x03]),
        Buffer.alloc(9),
      ]);

      const sources = [pngBuffer, jpegBuffer];
      const results = await getImageSpecsBatch(sources);

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        success: true,
        specs: {
          width: 320,
          height: 256,
          type: 'png',
        },
      });
      expect(results[1]).toMatchObject({
        success: true,
        specs: {
          width: 320,
          height: 256,
          type: 'jpg',
        },
      });
    });

    it('should handle mixed success and failure', async () => {
      const pngBuffer = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from([0x00, 0x00, 0x00, 0x0d]),
        Buffer.from('IHDR'),
        Buffer.from([0x00, 0x00, 0x01, 0x40]),
        Buffer.from([0x00, 0x00, 0x01, 0x00]),
        Buffer.from([0x08, 0x06, 0x00, 0x00, 0x00]),
        Buffer.alloc(4),
      ]);

      const invalidBuffer = Buffer.from([0x12, 0x34, 0x56, 0x78]);

      const sources = [pngBuffer, invalidBuffer];
      const results = await getImageSpecsBatch(sources);

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        success: true,
        specs: { type: 'png' },
      });
      expect(results[1]).toMatchObject({
        success: false,
        error: expect.any(ImageSpecsError),
      });
    });
  });

  describe('isImageSource', () => {
    it('should return true for valid image buffer', async () => {
      const pngBuffer = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from([0x00, 0x00, 0x00, 0x0d]),
        Buffer.from('IHDR'),
        Buffer.from([0x00, 0x00, 0x01, 0x40]),
        Buffer.from([0x00, 0x00, 0x01, 0x00]),
        Buffer.from([0x08, 0x06, 0x00, 0x00, 0x00]),
        Buffer.alloc(4),
      ]);

      const result = await isImageSource(pngBuffer);
      expect(result).toBe(true);
    });

    it('should return false for invalid buffer', async () => {
      const invalidBuffer = Buffer.from([0x12, 0x34, 0x56, 0x78]);

      const result = await isImageSource(invalidBuffer);
      expect(result).toBe(false);
    });

    it('should return true for valid image stream', async () => {
      const pngBuffer = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from([0x00, 0x00, 0x00, 0x0d]),
        Buffer.from('IHDR'),
        Buffer.from([0x00, 0x00, 0x01, 0x40]),
        Buffer.from([0x00, 0x00, 0x01, 0x00]),
        Buffer.from([0x08, 0x06, 0x00, 0x00, 0x00]),
        Buffer.alloc(4),
      ]);

      const stream = Readable.from(pngBuffer);
      const result = await isImageSource(stream);
      expect(result).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const { readStreamWithTimeout } = await import('../src/stream.js');
      vi.mocked(readStreamWithTimeout).mockRejectedValue(new Error('Stream error'));

      const stream = Readable.from(Buffer.from([0x12, 0x34]));
      const result = await isImageSource(stream);
      expect(result).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should wrap unknown errors', async () => {
      const invalidInput = { not: 'a valid input' } as any;

      await expect(getImageSpecs(invalidInput)).rejects.toThrow(ImageSpecsError);
    });

    it('should preserve ImageSpecsError instances', async () => {
      const emptyBuffer = Buffer.alloc(0);

      try {
        await getImageSpecs(emptyBuffer);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ImageSpecsError);
        expect((error as ImageSpecsError).code).toBe(ErrorCodes.INSUFFICIENT_DATA);
      }
    });
  });

  describe('Options handling', () => {
    it('should use default options when none provided', async () => {
      const pngBuffer = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from([0x00, 0x00, 0x00, 0x0d]),
        Buffer.from('IHDR'),
        Buffer.from([0x00, 0x00, 0x01, 0x40]),
        Buffer.from([0x00, 0x00, 0x01, 0x00]),
        Buffer.from([0x08, 0x06, 0x00, 0x00, 0x00]),
        Buffer.alloc(4),
      ]);

      const result = await getImageSpecs(pngBuffer);
      expect(result).toBeDefined();
    });

    it('should merge custom options with defaults', async () => {
      const pngBuffer = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from([0x00, 0x00, 0x00, 0x0d]),
        Buffer.from('IHDR'),
        Buffer.from([0x00, 0x00, 0x01, 0x40]),
        Buffer.from([0x00, 0x00, 0x01, 0x00]),
        Buffer.from([0x08, 0x06, 0x00, 0x00, 0x00]),
        Buffer.alloc(4),
      ]);

      const options = {
        timeout: 5000,
        maxBytes: 32768,
      };

      const result = await getImageSpecs(pngBuffer, options);
      expect(result).toBeDefined();
    });
  });
});
