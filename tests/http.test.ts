import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'stream';
import http from 'http';
import https from 'https';
import { fetchImageHeaders } from '../src/http.js';
import { ImageSpecsError } from '../src/types.js';

// Mock http and https modules
vi.mock('http');
vi.mock('https');

// Create a proper mock response type that extends Readable with HTTP response properties
interface MockResponse extends Readable {
  statusCode?: number;
  statusMessage?: string;
  headers?: Record<string, string | string[]>;
}

describe('HTTP Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchImageHeaders', () => {
    it('should fetch image from HTTP URL', async () => {
      const mockResponse = new Readable() as MockResponse;
      mockResponse.statusCode = 200;
      mockResponse.statusMessage = 'OK';
      mockResponse.headers = { 'content-type': 'image/jpeg' };

      const mockRequest = {
        on: vi.fn(),
        end: vi.fn(),
      };

      vi.mocked(http.request).mockImplementation(((...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          setTimeout(() => callback(mockResponse as any), 0);
        }
        return mockRequest as any;
      }) as any);

      const promise = fetchImageHeaders('http://example.com/image.jpg');

      // Simulate successful request
      setTimeout(() => {
        mockResponse.emit('end');
      }, 10);

      const result = await promise;

      expect(result.stream).toBe(mockResponse);
      expect(result.statusCode).toBe(200);
      expect(result.url).toBe('http://example.com/image.jpg');
    });

    it('should fetch image from HTTPS URL', async () => {
      const mockResponse = new Readable() as MockResponse;
      mockResponse.statusCode = 200;
      mockResponse.headers = { 'content-type': 'image/png' };

      const mockRequest = {
        on: vi.fn(),
        end: vi.fn(),
      };

      vi.mocked(https.request).mockImplementation(((...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          setTimeout(() => callback(mockResponse as any), 0);
        }
        return mockRequest as any;
      }) as any);

      const promise = fetchImageHeaders('https://example.com/image.png');

      setTimeout(() => {
        mockResponse.emit('end');
      }, 10);

      const result = await promise;

      expect(result.stream).toBe(mockResponse);
      expect(result.statusCode).toBe(200);
    });

    it('should handle redirects', async () => {
      const redirectResponse = new Readable() as MockResponse;
      redirectResponse.statusCode = 302;
      redirectResponse.headers = { location: 'https://redirect.com/image.jpg' };

      const finalResponse = new Readable() as MockResponse;
      finalResponse.statusCode = 200;
      finalResponse.headers = { 'content-type': 'image/jpeg' };

      const mockRequest = {
        on: vi.fn(),
        end: vi.fn(),
      };

      let requestCount = 0;
      vi.mocked(https.request).mockImplementation(((...args: any[]) => {
        requestCount++;
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          if (requestCount === 1) {
            setTimeout(() => callback(redirectResponse as any), 0);
          } else {
            setTimeout(() => callback(finalResponse as any), 0);
          }
        }
        return mockRequest as any;
      }) as any);

      const promise = fetchImageHeaders('https://example.com/image.jpg');

      setTimeout(() => {
        finalResponse.emit('end');
      }, 20);

      const result = await promise;
      expect(result.statusCode).toBe(200);
    });

    it('should handle HTTP errors', async () => {
      const mockResponse = new Readable() as MockResponse;
      mockResponse.statusCode = 404;
      mockResponse.statusMessage = 'Not Found';
      mockResponse.headers = {}; // Add headers property

      const mockRequest = {
        on: vi.fn(),
        end: vi.fn(),
      };

      vi.mocked(https.request).mockImplementation(((...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          setTimeout(() => callback(mockResponse as any), 0);
        }
        return mockRequest as any;
      }) as any);

      await expect(fetchImageHeaders('https://example.com/notfound.jpg')).rejects.toThrow(
        ImageSpecsError
      );
    });

    it('should handle request errors', async () => {
      const mockRequest = {
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Network error')), 0);
          }
        }),
        end: vi.fn(),
      };

      vi.mocked(https.request).mockReturnValue(mockRequest as any);

      await expect(fetchImageHeaders('https://example.com/image.jpg')).rejects.toThrow(
        ImageSpecsError
      );
    });

    it('should handle timeout', async () => {
      const mockRequest = {
        on: vi.fn((event, callback) => {
          if (event === 'timeout') {
            setTimeout(() => callback(), 0);
          }
        }),
        end: vi.fn(),
        destroy: vi.fn(),
      };

      vi.mocked(https.request).mockReturnValue(mockRequest as any);

      await expect(fetchImageHeaders('https://example.com/image.jpg')).rejects.toThrow(
        ImageSpecsError
      );
    });

    it('should reject invalid URLs', async () => {
      await expect(fetchImageHeaders('invalid-url')).rejects.toThrow(ImageSpecsError);
      await expect(fetchImageHeaders('ftp://example.com/file')).rejects.toThrow(ImageSpecsError);
    });

    it('should use custom options', async () => {
      const mockResponse = new Readable() as MockResponse;
      mockResponse.statusCode = 200;
      mockResponse.headers = {};

      const mockRequest = {
        on: vi.fn(),
        end: vi.fn(),
      };

      vi.mocked(https.request).mockImplementation(((...args: any[]) => {
        const options = args[0];
        const callback = args[args.length - 1];
        expect(options).toMatchObject({
          headers: expect.objectContaining({
            'User-Agent': 'custom-agent',
            'Custom-Header': 'value',
          }),
          timeout: 5000,
        });
        if (typeof callback === 'function') {
          setTimeout(() => callback(mockResponse as any), 0);
        }
        return mockRequest as any;
      }) as any);

      const promise = fetchImageHeaders('https://example.com/image.jpg', {
        timeout: 5000,
        userAgent: 'custom-agent',
        headers: { 'Custom-Header': 'value' },
      });

      setTimeout(() => {
        mockResponse.emit('end');
      }, 10);

      await promise;
    });

    it('should include Range header for partial content', async () => {
      const mockResponse = new Readable() as MockResponse;
      mockResponse.statusCode = 206; // Partial content
      mockResponse.headers = { 'content-range': 'bytes 0-65535/100000' };

      const mockRequest = {
        on: vi.fn(),
        end: vi.fn(),
      };

      vi.mocked(https.request).mockImplementation(((...args: any[]) => {
        const options = args[0];
        const callback = args[args.length - 1];
        expect(options).toMatchObject({
          headers: expect.objectContaining({
            Range: expect.stringMatching(/^bytes=0-\d+$/),
          }),
        });
        if (typeof callback === 'function') {
          setTimeout(() => callback(mockResponse as any), 0);
        }
        return mockRequest as any;
      }) as any);

      const promise = fetchImageHeaders('https://example.com/image.jpg');

      setTimeout(() => {
        mockResponse.emit('end');
      }, 10);

      await promise;
    });

    it('should accept 200 response for full content', async () => {
      const mockResponse = new Readable() as MockResponse;
      mockResponse.statusCode = 200;
      mockResponse.headers = {};

      const mockRequest = {
        on: vi.fn(),
        end: vi.fn(),
      };

      vi.mocked(https.request).mockImplementation(((...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          setTimeout(() => callback(mockResponse as any), 0);
        }
        return mockRequest as any;
      }) as any);

      const promise = fetchImageHeaders('https://example.com/image.jpg');

      setTimeout(() => {
        mockResponse.emit('end');
      }, 10);

      const result = await promise;
      expect(result.statusCode).toBe(200);
    });
  });
});
