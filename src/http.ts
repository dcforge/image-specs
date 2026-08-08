import { Readable } from 'stream';
import type { ReadableStream as NodeReadableStream } from 'stream/web';
import { ImageSpecsError, ErrorCodes, type ImageSpecsOptions, DEFAULT_OPTIONS } from './types.js';

interface HttpResponse {
  stream: Readable;
  headers: Record<string, string | string[] | undefined>;
  statusCode: number;
  url: string;
}

const MAX_REDIRECTS = 5;
const SENSITIVE_HEADERS = ['authorization', 'cookie', 'proxy-authorization', 'host'];

function validateUrl(url: string | URL, base?: URL): URL {
  try {
    const parsedUrl = new URL(url, base);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('Only HTTP and HTTPS protocols are supported');
    }
    return parsedUrl;
  } catch (error) {
    throw new ImageSpecsError(
      `Invalid URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ErrorCodes.INVALID_URL
    );
  }
}

async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Preserve the redirect or HTTP error that caused the cancellation.
  }
}

async function fetchWithTimeout(url: URL, headers: Headers, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      headers,
      redirect: 'manual',
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ImageSpecsError('Request timeout', ErrorCodes.TIMEOUT);
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new ImageSpecsError(`Request error: ${message}`, ErrorCodes.NETWORK_ERROR);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch image content with a bounded range request.
 */
export async function fetchImageHeaders(
  url: string,
  options: ImageSpecsOptions = {}
): Promise<HttpResponse> {
  const opts = {
    timeout: options.timeout ?? DEFAULT_OPTIONS.timeout,
    headers: options.headers ?? DEFAULT_OPTIONS.headers,
    maxBytes: options.maxBytes ?? DEFAULT_OPTIONS.maxBytes,
    userAgent: options.userAgent ?? DEFAULT_OPTIONS.userAgent,
  };
  let currentUrl = validateUrl(url);
  const headers = new Headers({
    'User-Agent': opts.userAgent,
    Accept: 'image/*,*/*;q=0.8',
    'Accept-Encoding': 'identity',
    Range: `bytes=0-${opts.maxBytes - 1}`,
  });
  for (const [name, value] of Object.entries(opts.headers)) {
    headers.set(name, value);
  }

  for (let redirectCount = 0; ; redirectCount += 1) {
    const response = await fetchWithTimeout(currentUrl, new Headers(headers), opts.timeout);
    const location = response.headers.get('location');

    if (response.status >= 300 && response.status < 400 && location) {
      await cancelBody(response);
      if (redirectCount >= MAX_REDIRECTS) {
        throw new ImageSpecsError('Too many redirects', ErrorCodes.NETWORK_ERROR);
      }

      const redirectUrl = validateUrl(location, currentUrl);
      if (redirectUrl.origin !== currentUrl.origin) {
        for (const header of SENSITIVE_HEADERS) {
          headers.delete(header);
        }
      }
      currentUrl = redirectUrl;
      continue;
    }

    if (response.status !== 200 && response.status !== 206) {
      await cancelBody(response);
      throw new ImageSpecsError(
        `HTTP ${response.status}: ${response.statusText || 'Unknown error'}`,
        ErrorCodes.NETWORK_ERROR
      );
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, name) => {
      responseHeaders[name] = value;
    });

    return {
      stream: response.body
        ? Readable.fromWeb(response.body as NodeReadableStream<Uint8Array>)
        : Readable.from([]),
      headers: responseHeaders,
      statusCode: response.status,
      url: currentUrl.toString(),
    };
  }
}
