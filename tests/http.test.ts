import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Readable } from 'stream';
import { fetchImageHeaders } from '../src/http.js';
import { ErrorCodes, type ImageSpecsOptions } from '../src/types.js';

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function stubFetch(...responses: Response[]): ReturnType<typeof vi.fn<typeof fetch>> {
  const fetchMock = vi.fn<typeof fetch>();
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(response);
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function cancellableResponse(
  status: number,
  headers?: HeadersInit
): { response: Response; wasCancelled: () => boolean } {
  let cancelled = false;
  const body = new ReadableStream({
    cancel() {
      cancelled = true;
    },
  });
  return {
    response: new Response(body, headers ? { status, headers } : { status }),
    wasCancelled: () => cancelled,
  };
}

describe('HTTP Utilities', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('fetchImageHeaders', () => {
    it.each([200, 206])('accepts a %i response as a Node stream', async (status) => {
      const fetchMock = stubFetch(
        new Response(Uint8Array.from([1, 2, 3]), {
          status,
          headers: { 'Content-Type': 'image/jpeg' },
        })
      );

      const result = await fetchImageHeaders('http://example.com/image.jpg');

      expect(result).toMatchObject({
        statusCode: status,
        url: 'http://example.com/image.jpg',
        headers: { 'content-type': 'image/jpeg' },
      });
      expect(await readAll(result.stream)).toEqual(Buffer.from([1, 2, 3]));
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('sends range and custom request headers with manual redirects', async () => {
      const fetchMock = stubFetch(new Response(Uint8Array.from([1]), { status: 200 }));

      await fetchImageHeaders('https://example.com/image.png', {
        timeout: 5000,
        maxBytes: 1024,
        userAgent: 'custom-agent',
        headers: { 'Custom-Header': 'value' },
      });

      const [, request] = fetchMock.mock.calls[0]!;
      const headers = request?.headers as Headers;
      expect(request).toMatchObject({ redirect: 'manual' });
      expect(headers.get('user-agent')).toBe('custom-agent');
      expect(headers.get('custom-header')).toBe('value');
      expect(headers.get('range')).toBe('bytes=0-1023');
      expect(headers.get('accept-encoding')).toBe('identity');
    });

    it('allows custom headers to override defaults case-insensitively', async () => {
      const fetchMock = stubFetch(new Response(Uint8Array.from([1]), { status: 200 }));

      await fetchImageHeaders('https://example.com/image.png', {
        headers: { range: 'bytes=0-7', 'user-agent': 'header-agent' },
      });

      const headers = fetchMock.mock.calls[0]![1]?.headers as Headers;
      expect(headers.get('range')).toBe('bytes=0-7');
      expect(headers.get('user-agent')).toBe('header-agent');
    });

    it('uses defaults when optional values are explicitly undefined', async () => {
      const fetchMock = stubFetch(new Response(Uint8Array.from([1]), { status: 200 }));

      const options = {
        timeout: undefined,
        headers: undefined,
        maxBytes: undefined,
        userAgent: undefined,
      } as unknown as ImageSpecsOptions;
      await fetchImageHeaders('https://example.com/image.png', options);

      const headers = fetchMock.mock.calls[0]![1]?.headers as Headers;
      expect(headers.get('range')).toBe('bytes=0-65535');
      expect(headers.get('user-agent')).toMatch(/^image-specs\//);
    });

    it('follows relative redirects and cancels their bodies', async () => {
      const redirect = cancellableResponse(302, { Location: '/final.jpg' });
      const fetchMock = stubFetch(
        redirect.response,
        new Response(Uint8Array.from([1]), { status: 200 })
      );

      const result = await fetchImageHeaders('https://example.com/start.jpg');

      expect(result.url).toBe('https://example.com/final.jpg');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(redirect.wasCancelled()).toBe(true);
    });

    it('strips sensitive headers from cross-origin redirects', async () => {
      const redirect = cancellableResponse(302, { Location: 'https://cdn.example/image.jpg' });
      const fetchMock = stubFetch(
        redirect.response,
        new Response(Uint8Array.from([1]), { status: 200 })
      );

      await fetchImageHeaders('https://example.com/image.jpg', {
        headers: {
          Authorization: 'Bearer secret',
          Cookie: 'session=secret',
          'Proxy-Authorization': 'proxy-secret',
          Host: 'example.com',
          'X-Keep': 'safe',
        },
      });

      const redirectedHeaders = fetchMock.mock.calls[1]![1]?.headers as Headers;
      expect(redirectedHeaders.get('authorization')).toBeNull();
      expect(redirectedHeaders.get('cookie')).toBeNull();
      expect(redirectedHeaders.get('proxy-authorization')).toBeNull();
      expect(redirectedHeaders.get('host')).toBeNull();
      expect(redirectedHeaders.get('x-keep')).toBe('safe');
    });

    it('keeps custom headers on same-origin redirects', async () => {
      const redirect = cancellableResponse(302, { Location: '/final.jpg' });
      const fetchMock = stubFetch(
        redirect.response,
        new Response(Uint8Array.from([1]), { status: 200 })
      );

      await fetchImageHeaders('https://example.com/image.jpg', {
        headers: { Authorization: 'Bearer secret' },
      });

      const redirectedHeaders = fetchMock.mock.calls[1]![1]?.headers as Headers;
      expect(redirectedHeaders.get('authorization')).toBe('Bearer secret');
    });

    it('rejects redirects to unsupported protocols after cancelling the body', async () => {
      const redirect = cancellableResponse(302, { Location: 'file:///tmp/image.jpg' });
      const fetchMock = stubFetch(redirect.response);

      await expect(fetchImageHeaders('https://example.com/image.jpg')).rejects.toMatchObject({
        code: ErrorCodes.INVALID_URL,
      });
      expect(redirect.wasCancelled()).toBe(true);
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('rejects after five redirects and cancels the final redirect body', async () => {
      const redirects = Array.from({ length: 6 }, (_, index) =>
        cancellableResponse(302, { Location: `/redirect-${index + 1}` })
      );
      const fetchMock = stubFetch(...redirects.map(({ response }) => response));

      await expect(fetchImageHeaders('https://example.com/start')).rejects.toMatchObject({
        code: ErrorCodes.NETWORK_ERROR,
        message: 'Too many redirects',
      });
      expect(fetchMock).toHaveBeenCalledTimes(6);
      expect(redirects.every(({ wasCancelled }) => wasCancelled())).toBe(true);
    });

    it('cancels unsuccessful response bodies and preserves the HTTP error', async () => {
      const notFound = cancellableResponse(404);
      stubFetch(notFound.response);

      await expect(fetchImageHeaders('https://example.com/missing.jpg')).rejects.toMatchObject({
        code: ErrorCodes.NETWORK_ERROR,
        message: 'HTTP 404: Unknown error',
      });
      expect(notFound.wasCancelled()).toBe(true);
    });

    it('maps fetch failures to network errors', async () => {
      const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error('socket failed'));
      vi.stubGlobal('fetch', fetchMock);

      await expect(fetchImageHeaders('https://example.com/image.jpg')).rejects.toMatchObject({
        code: ErrorCodes.NETWORK_ERROR,
        message: 'Request error: socket failed',
      });
    });

    it('times out while waiting for response headers', async () => {
      vi.useFakeTimers();
      const fetchMock = vi.fn<typeof fetch>((_url, init) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
      });
      vi.stubGlobal('fetch', fetchMock);

      const request = fetchImageHeaders('https://example.com/image.jpg', { timeout: 100 });
      const assertion = expect(request).rejects.toMatchObject({
        code: ErrorCodes.TIMEOUT,
        message: 'Request timeout',
      });
      await vi.advanceTimersByTimeAsync(101);
      await assertion;
    });

    it('rejects invalid and unsupported URLs before fetching', async () => {
      const fetchMock = vi.fn<typeof fetch>();
      vi.stubGlobal('fetch', fetchMock);

      await expect(fetchImageHeaders('invalid-url')).rejects.toMatchObject({
        code: ErrorCodes.INVALID_URL,
      });
      await expect(fetchImageHeaders('ftp://example.com/file')).rejects.toMatchObject({
        code: ErrorCodes.INVALID_URL,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
