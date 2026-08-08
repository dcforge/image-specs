import { createServer } from 'http';
import { describe, expect, it } from 'vitest';
import { getImageSpecs } from '../src/index.js';

function createLargeMetadataJPEG(): Buffer {
  const appPayload = Buffer.alloc(65533);
  const startOfFrame = Buffer.from([
    0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x02, 0x00, 0x03, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00,
    0x03, 0x11, 0x00,
  ]);

  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]),
    appPayload,
    startOfFrame,
    Buffer.from([0xff, 0xd9]),
  ]);
}

describe('URL range retries', () => {
  it('fetches more data when JPEG metadata extends beyond the initial range', async () => {
    const jpeg = createLargeMetadataJPEG();
    const ranges: (string | undefined)[] = [];
    const server = createServer((request, response) => {
      const range = request.headers.range;
      ranges.push(range);

      const end = Math.min(Number(range?.match(/bytes=0-(\d+)/)?.[1]), jpeg.length - 1);
      const body = jpeg.subarray(0, end + 1);
      response.writeHead(206, {
        'Accept-Ranges': 'bytes',
        'Content-Length': body.length,
        'Content-Range': `bytes 0-${end}/${jpeg.length}`,
      });
      response.end(body);
    });

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Server address unavailable');

      const url = `http://127.0.0.1:${address.port}/large.jpg`;
      const expected = await getImageSpecs(url, { maxBytes: 1048576 });
      const actual = await getImageSpecs(url);

      expect(actual).toEqual(expected);
      expect(actual).toMatchObject({
        width: 3,
        height: 2,
        type: 'jpg',
        mime: 'image/jpeg',
      });
      expect(ranges).toEqual(['bytes=0-1048575', 'bytes=0-65535', 'bytes=0-131071']);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
