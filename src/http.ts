import { type Readable } from 'stream';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { ImageSpecsError, ErrorCodes, type ImageSpecsOptions, DEFAULT_OPTIONS } from './types.js';

/**
 * HTTP response interface
 */
interface HttpResponse {
  stream: Readable;
  headers: Record<string, string | string[] | undefined>;
  statusCode: number;
  url: string;
}

/**
 * Internal options with redirect tracking
 */
interface InternalOptions extends ImageSpecsOptions {
  redirectCount?: number;
}

/**
 * Validate URL format
 */
function validateUrl(url: string): URL {
  try {
    const parsedUrl = new URL(url);
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

/**
 * Handle HTTP redirects
 */
async function handleRedirect(
  statusCode: number,
  location: string | string[] | undefined,
  baseUrl: string,
  options: InternalOptions,
  fetchFunction: (url: string, opts: InternalOptions) => Promise<HttpResponse>
): Promise<HttpResponse | null> {
  if (statusCode >= 300 && statusCode < 400 && location) {
    const locationStr = Array.isArray(location) ? location[0] : location;
    if (!locationStr) {
      return null;
    }
    const redirectUrl = new URL(locationStr, baseUrl).toString();
    const maxRedirects = 5;
    const redirectCount = options.redirectCount ?? 0;

    if (redirectCount >= maxRedirects) {
      throw new ImageSpecsError('Too many redirects', ErrorCodes.NETWORK_ERROR);
    }

    return fetchFunction(redirectUrl, { ...options, redirectCount: redirectCount + 1 });
  }
  return null;
}

/**
 * Fetch image content from URL with Range header support for efficient partial content fetching
 */
export async function fetchImageHeaders(
  url: string,
  options: ImageSpecsOptions = {}
): Promise<HttpResponse> {
  const parsedUrl = validateUrl(url);
  const opts: InternalOptions = { ...DEFAULT_OPTIONS, ...options };

  return new Promise<HttpResponse>((resolve, reject) => {
    const isHttps = parsedUrl.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    // Try range request for first few KB
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': opts.userAgent,
        Accept: 'image/*,*/*;q=0.8',
        'Accept-Encoding': 'identity',
        Range: `bytes=0-${(opts.maxBytes ?? DEFAULT_OPTIONS.maxBytes) - 1}`,
        ...opts.headers,
      },
      timeout: opts.timeout,
    };

    const request = httpModule.request(requestOptions, (response) => {
      const { statusCode = 0, headers } = response;

      // Handle redirects
      void handleRedirect(statusCode, headers.location, url, opts, fetchImageHeaders)
        .then((redirectResult) => {
          if (redirectResult) {
            resolve(redirectResult);
            return;
          }

          // Accept both 200 (full content) and 206 (partial content)
          if (statusCode !== 200 && statusCode !== 206) {
            reject(
              new ImageSpecsError(
                `HTTP ${statusCode}: ${response.statusMessage ?? 'Unknown error'}`,
                ErrorCodes.NETWORK_ERROR
              )
            );
            return;
          }

          // No response-level timeout - let stream reading handle timeouts
          response.on('error', (error: Error) => {
            reject(
              new ImageSpecsError(`Response error: ${error.message}`, ErrorCodes.NETWORK_ERROR)
            );
          });

          resolve({
            stream: response,
            headers,
            statusCode,
            url,
          });
        })
        .catch((error: unknown) => {
          reject(
            error instanceof Error
              ? error
              : new ImageSpecsError(String(error), ErrorCodes.NETWORK_ERROR)
          );
        });
    });

    request.on('error', (error: Error) => {
      reject(new ImageSpecsError(`Request error: ${error.message}`, ErrorCodes.NETWORK_ERROR));
    });

    request.on('timeout', () => {
      request.destroy();
      reject(new ImageSpecsError('Request timeout', ErrorCodes.TIMEOUT));
    });

    request.end();
  });
}
