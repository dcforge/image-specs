import { describe, it, expect } from 'vitest';
import {
  parseJPEG,
  parsePNG,
  parseGIF,
  parseBMP,
  parseWebP,
  parseAVIF,
  parseSVG,
  parseICO,
  parseImage,
} from '../src/parsers/index.js';

function webPChunk(type: string, data: Buffer): Buffer {
  const size = Buffer.alloc(4);
  size.writeUInt32LE(data.length);
  return Buffer.concat([Buffer.from(type), size, data, Buffer.alloc(data.length % 2)]);
}

function webP(...chunks: Buffer[]): Buffer {
  const contents = Buffer.concat([Buffer.from('WEBP'), ...chunks]);
  const size = Buffer.alloc(4);
  size.writeUInt32LE(contents.length);
  return Buffer.concat([Buffer.from('RIFF'), size, contents]);
}

function vp8(width: number, height: number): Buffer {
  const data = Buffer.alloc(10);
  data.set([0x9d, 0x01, 0x2a], 3);
  data.writeUInt32LE((((height & 0x3fff) << 16) | (width & 0x3fff)) >>> 0, 6);
  return data;
}

function vp8l(width: number, height: number): Buffer {
  const data = Buffer.alloc(5);
  data[0] = 0x2f;
  data.writeUInt32LE((((height - 1) << 14) | (width - 1)) >>> 0, 1);
  return data;
}

function vp8x(width: number, height: number, flags = 0): Buffer {
  const data = Buffer.alloc(10);
  data[0] = flags;
  data.writeUIntLE(width - 1, 4, 3);
  data.writeUIntLE(height - 1, 7, 3);
  return data;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  return Buffer.concat([size, Buffer.from(type), data, Buffer.alloc(4)]);
}

function png(...chunks: Buffer[]): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(100, 0);
  ihdr.writeUInt32BE(80, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    ...chunks,
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function pngWithIccProfile(profileData: Buffer): Buffer {
  return png(pngChunk('iCCP', profileData));
}

function isoBox(type: string, ...contents: Buffer[]): Buffer {
  const data = Buffer.concat(contents);
  const header = Buffer.alloc(8);
  header.writeUInt32BE(header.length + data.length);
  header.write(type, 4, 'ascii');
  return Buffer.concat([header, data]);
}

function avifWithProperties(...properties: Buffer[]): Buffer {
  return Buffer.concat([
    isoBox('ftyp', Buffer.from('avif'), Buffer.alloc(4)),
    isoBox('meta', Buffer.alloc(4), isoBox('iprp', isoBox('ipco', ...properties))),
  ]);
}

function ispe(width: number, height: number): Buffer {
  const data = Buffer.alloc(12);
  data.writeUInt32BE(width, 4);
  data.writeUInt32BE(height, 8);
  return isoBox('ispe', data);
}

describe('Image Parsers', () => {
  describe('parseJPEG', () => {
    it('should parse valid JPEG header', () => {
      // Minimal JPEG with SOI + SOF0 markers
      const jpegBuffer = Buffer.concat([
        Buffer.from([0xff, 0xd8]), // SOI
        Buffer.from([0xff, 0xe0]), // APP0
        Buffer.from([0x00, 0x10]), // Length
        Buffer.from('JFIF\0'), // JFIF identifier
        Buffer.from([0x01, 0x01]), // Version
        Buffer.from([0x01]), // Units (DPI)
        Buffer.from([0x00, 0x48]), // X density (72)
        Buffer.from([0x00, 0x48]), // Y density (72)
        Buffer.from([0x00, 0x00]), // Thumbnail dimensions
        Buffer.from([0xff, 0xc0]), // SOF0
        Buffer.from([0x00, 0x11]), // Length
        Buffer.from([0x08]), // Precision
        Buffer.from([0x01, 0x00]), // Height (256)
        Buffer.from([0x01, 0x40]), // Width (320)
        Buffer.from([0x03]), // Components
        Buffer.alloc(9), // Component data
      ]);

      const result = parseJPEG(jpegBuffer);
      expect(result).toMatchObject({
        width: 320,
        height: 256,
        type: 'jpg',
        mime: 'image/jpeg',
        wUnits: 'px',
        hUnits: 'px',
        wResolution: 72,
        hResolution: 72,
      });
      // Check that new fields are present
      expect(result?.bitDepth).toBe(8);
      expect(result?.channels).toBe(3);
    });

    it('should return null for invalid JPEG', () => {
      const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      const result = parseJPEG(invalidBuffer);
      expect(result).toBeNull();
    });

    it('should handle JPEG without JFIF segment', () => {
      const jpegBuffer = Buffer.concat([
        Buffer.from([0xff, 0xd8]), // SOI
        Buffer.from([0xff, 0xc0]), // SOF0
        Buffer.from([0x00, 0x11]), // Length
        Buffer.from([0x08]), // Precision
        Buffer.from([0x01, 0x00]), // Height (256)
        Buffer.from([0x01, 0x40]), // Width (320)
        Buffer.from([0x03]), // Components
        Buffer.alloc(9), // Component data
      ]);

      const result = parseJPEG(jpegBuffer);
      expect(result).toMatchObject({
        width: 320,
        height: 256,
        type: 'jpg',
        mime: 'image/jpeg',
        wUnits: 'px',
        hUnits: 'px',
      });
    });
  });

  describe('parsePNG', () => {
    it('should parse valid PNG header', () => {
      const pngBuffer = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG signature
        Buffer.from([0x00, 0x00, 0x00, 0x0d]), // IHDR length
        Buffer.from('IHDR'), // IHDR type
        Buffer.from([0x00, 0x00, 0x01, 0x40]), // Width (320)
        Buffer.from([0x00, 0x00, 0x01, 0x00]), // Height (256)
        Buffer.from([0x08]), // Bit depth
        Buffer.from([0x06]), // Color type
        Buffer.from([0x00]), // Compression
        Buffer.from([0x00]), // Filter
        Buffer.from([0x00]), // Interlace
        Buffer.alloc(4), // CRC
      ]);

      const result = parsePNG(pngBuffer);
      expect(result).toMatchObject({
        width: 320,
        height: 256,
        type: 'png',
        mime: 'image/png',
        wUnits: 'px',
        hUnits: 'px',
      });
      // Check that new fields are present
      expect(result?.bitDepth).toBe(8);
      expect(result?.channels).toBe(4);
    });

    it('should return null for invalid PNG', () => {
      const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      const result = parsePNG(invalidBuffer);
      expect(result).toBeNull();
    });

    it('should parse PNG with pHYs chunk', () => {
      const pngBuffer = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG signature
        Buffer.from([0x00, 0x00, 0x00, 0x0d]), // IHDR length
        Buffer.from('IHDR'), // IHDR type
        Buffer.from([0x00, 0x00, 0x01, 0x40]), // Width (320)
        Buffer.from([0x00, 0x00, 0x01, 0x00]), // Height (256)
        Buffer.from([0x08, 0x06, 0x00, 0x00, 0x00]), // IHDR data
        Buffer.alloc(4), // IHDR CRC
        Buffer.from([0x00, 0x00, 0x00, 0x09]), // pHYs length
        Buffer.from('pHYs'), // pHYs type
        Buffer.from([0x00, 0x00, 0x0b, 0x13]), // X pixels per meter (2835 = 72 DPI)
        Buffer.from([0x00, 0x00, 0x0b, 0x13]), // Y pixels per meter (2835 = 72 DPI)
        Buffer.from([0x01]), // Unit (meters)
        Buffer.alloc(4), // pHYs CRC
      ]);

      const result = parsePNG(pngBuffer);
      expect(result).toMatchObject({
        width: 320,
        height: 256,
        type: 'png',
        mime: 'image/png',
        wUnits: 'px',
        hUnits: 'px',
        wResolution: 72,
        hResolution: 72,
      });
    });

    it('should read an iCCP profile name up to its null terminator', () => {
      const result = parsePNG(
        pngWithIccProfile(Buffer.concat([Buffer.from('Display P3\0'), Buffer.from([0, 1, 2, 3])]))
      );

      expect(result?.iccProfile).toBe('Display P3');
    });

    it('should preserve an unterminated iCCP profile name', () => {
      const result = parsePNG(pngWithIccProfile(Buffer.from('Unterminated profile', 'latin1')));

      expect(result?.iccProfile).toBe('Unterminated profile');
    });

    it('should omit an empty iCCP profile name', () => {
      const result = parsePNG(pngWithIccProfile(Buffer.from([0, 0, 1, 2, 3])));

      expect(result).not.toHaveProperty('iccProfile');
    });

    it('should ignore a truncated chunk without reading beyond its declared bounds', () => {
      const truncatedIcc = pngChunk('iCCP', Buffer.from('Profile'));
      truncatedIcc.writeUInt32BE(100, 0);

      const result = parsePNG(png(truncatedIcc));

      expect(result).toMatchObject({ width: 100, height: 80 });
      expect(result).not.toHaveProperty('iccProfile');
    });
  });

  describe('parseGIF', () => {
    it('should parse GIF87a', () => {
      const gifBuffer = Buffer.concat([
        Buffer.from('GIF87a'), // Signature
        Buffer.from([0x40, 0x01]), // Width (320)
        Buffer.from([0x00, 0x01]), // Height (256)
        Buffer.alloc(3), // Other header data
      ]);

      const result = parseGIF(gifBuffer);
      expect(result).toEqual({
        width: 320,
        height: 256,
        type: 'gif',
        mime: 'image/gif',
        wUnits: 'px',
        hUnits: 'px',
      });
    });

    it('should parse GIF89a', () => {
      const gifBuffer = Buffer.concat([
        Buffer.from('GIF89a'), // Signature
        Buffer.from([0x40, 0x01]), // Width (320)
        Buffer.from([0x00, 0x01]), // Height (256)
        Buffer.alloc(3), // Other header data
      ]);

      const result = parseGIF(gifBuffer);
      expect(result).toEqual({
        width: 320,
        height: 256,
        type: 'gif',
        mime: 'image/gif',
        wUnits: 'px',
        hUnits: 'px',
      });
    });

    it('should return null for invalid GIF', () => {
      const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      const result = parseGIF(invalidBuffer);
      expect(result).toBeNull();
    });
  });

  describe('parseBMP', () => {
    it('should parse BMP with BITMAPINFOHEADER', () => {
      const bmpBuffer = Buffer.alloc(54);
      // BM signature
      bmpBuffer[0] = 0x42;
      bmpBuffer[1] = 0x4d;
      // DIB header size (40) at offset 14
      bmpBuffer.writeUInt32LE(40, 14);
      // Width (320) at offset 18
      bmpBuffer.writeInt32LE(320, 18);
      // Height (256) at offset 22
      bmpBuffer.writeInt32LE(256, 22);
      // Planes (1) at offset 26
      bmpBuffer.writeUInt16LE(1, 26);
      // Bit depth (24) at offset 28
      bmpBuffer.writeUInt16LE(24, 28);
      // X pixels per meter (2835 = 72 DPI) at offset 38
      bmpBuffer.writeInt32LE(2835, 38);
      // Y pixels per meter (2835 = 72 DPI) at offset 42
      bmpBuffer.writeInt32LE(2835, 42);

      const result = parseBMP(bmpBuffer);
      expect(result).toEqual({
        width: 320,
        height: 256,
        type: 'bmp',
        mime: 'image/bmp',
        wUnits: 'px',
        hUnits: 'px',
        wResolution: 72,
        hResolution: 72,
        bitDepth: 24,
        channels: 3,
      });
    });

    it('should return null for invalid BMP', () => {
      const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      const result = parseBMP(invalidBuffer);
      expect(result).toBeNull();
    });
  });

  describe('parseWebP', () => {
    it('should parse VP8 dimensions', () => {
      const result = parseWebP(webP(webPChunk('VP8 ', vp8(320, 256))));

      expect(result).toMatchObject({ width: 320, height: 256, channels: 3 });
    });

    it('should parse VP8L dimensions and alpha support', () => {
      const result = parseWebP(webP(webPChunk('VP8L', vp8l(321, 257))));

      expect(result).toMatchObject({ width: 321, height: 257, channels: 4 });
    });

    it('should combine VP8X dimensions with a later ICC profile', () => {
      const profile = Buffer.concat([Buffer.alloc(64), Buffer.from('Display P3')]);
      const result = parseWebP(
        webP(webPChunk('VP8X', vp8x(640, 480, 0x30)), webPChunk('ICCP', profile))
      );

      expect(result).toMatchObject({
        width: 640,
        height: 480,
        channels: 4,
        colorSpace: 'Display P3',
        iccProfile: 'Display P3',
      });
    });

    it('should keep dimensions and alpha from the first valid VP8X chunk', () => {
      const result = parseWebP(
        webP(webPChunk('VP8X', vp8x(640, 480, 0x10)), webPChunk('VP8X', vp8x(800, 600)))
      );

      expect(result).toMatchObject({ width: 640, height: 480, channels: 4 });
    });

    it('should skip a malformed VP8X chunk and use the next valid one', () => {
      const result = parseWebP(
        webP(webPChunk('VP8X', Buffer.alloc(9)), webPChunk('VP8X', vp8x(800, 600)))
      );

      expect(result).toMatchObject({ width: 800, height: 600, channels: 3 });
    });

    it('should return null for a truncated chunk', () => {
      const malformedChunk = Buffer.concat([
        Buffer.from('VP8X'),
        Buffer.from([10, 0, 0, 0]),
        Buffer.alloc(9),
      ]);

      expect(parseWebP(webP(malformedChunk))).toBeNull();
    });
  });

  describe('parseAVIF', () => {
    it('should find dimensions nested under meta, iprp, and ipco boxes', () => {
      expect(parseAVIF(avifWithProperties(ispe(1920, 1080)))).toEqual({
        width: 1920,
        height: 1080,
        type: 'avif',
        mime: 'image/avif',
        wUnits: 'px',
        hUnits: 'px',
      });
    });

    it('should reject an ispe payload truncated before its height', () => {
      const truncated = Buffer.alloc(8);
      truncated.writeUInt32BE(640, 4);

      expect(
        parseAVIF(avifWithProperties(isoBox('ispe', truncated), isoBox('free', Buffer.alloc(4))))
      ).toBeNull();
    });

    it('should reject a box whose declared size extends past the file', () => {
      const truncated = avifWithProperties(ispe(640, 480));
      truncated.writeUInt32BE(truncated.length, 16); // meta starts after the 16-byte ftyp box

      expect(parseAVIF(truncated)).toBeNull();
    });

    it('should reject a box smaller than its header', () => {
      const invalidBox = Buffer.alloc(8);
      invalidBox.writeUInt32BE(4);
      invalidBox.write('meta', 4, 'ascii');

      expect(
        parseAVIF(Buffer.concat([isoBox('ftyp', Buffer.from('avif'), Buffer.alloc(4)), invalidBox]))
      ).toBeNull();
    });
  });

  describe('parseSVG', () => {
    it('should parse SVG with width and height attributes', () => {
      const svgContent = '<svg width="320" height="256" xmlns="http://www.w3.org/2000/svg"></svg>';
      const svgBuffer = Buffer.from(svgContent);

      const result = parseSVG(svgBuffer);
      expect(result).toEqual({
        width: 320,
        height: 256,
        type: 'svg',
        mime: 'image/svg+xml',
        wUnits: 'px',
        hUnits: 'px',
      });
    });

    it('should parse SVG with viewBox', () => {
      const svgContent = '<svg viewBox="0 0 320 256" xmlns="http://www.w3.org/2000/svg"></svg>';
      const svgBuffer = Buffer.from(svgContent);

      const result = parseSVG(svgBuffer);
      expect(result).toEqual({
        width: 320,
        height: 256,
        type: 'svg',
        mime: 'image/svg+xml',
        wUnits: 'px',
        hUnits: 'px',
      });
    });

    it('should parse SVG with units', () => {
      const svgContent = '<svg width="10cm" height="8cm" xmlns="http://www.w3.org/2000/svg"></svg>';
      const svgBuffer = Buffer.from(svgContent);

      const result = parseSVG(svgBuffer);
      expect(result).toEqual({
        width: 378, // ~10cm converted to pixels
        height: 302, // ~8cm converted to pixels
        type: 'svg',
        mime: 'image/svg+xml',
        wUnits: 'cm',
        hUnits: 'cm',
      });
    });

    it('should return null for invalid SVG', () => {
      const invalidBuffer = Buffer.from('not an svg file');
      const result = parseSVG(invalidBuffer);
      expect(result).toBeNull();
    });

    it('should preserve case-sensitive SVG detection', () => {
      expect(parseSVG(Buffer.from('<SVG width="10" height="20"></SVG>'))).toBeNull();
    });
  });

  describe('parseICO', () => {
    it('should parse ICO header', () => {
      const icoBuffer = Buffer.concat([
        Buffer.from([0x00, 0x00]), // Reserved
        Buffer.from([0x01, 0x00]), // Type (ICO)
        Buffer.from([0x01, 0x00]), // Count (1 image)
        Buffer.from([0x20]), // Width (32, but 0 means 256)
        Buffer.from([0x20]), // Height (32, but 0 means 256)
        Buffer.from([0x00]), // Color count
        Buffer.from([0x00]), // Reserved
        Buffer.from([0x01, 0x00]), // Planes
        Buffer.from([0x20, 0x00]), // Bit count (32)
        Buffer.from([0x00, 0x04, 0x00, 0x00]), // Size in bytes
        Buffer.from([0x16, 0x00, 0x00, 0x00]), // Offset
      ]);

      const result = parseICO(icoBuffer);
      expect(result).toEqual({
        width: 32,
        height: 32,
        type: 'ico',
        mime: 'image/x-icon',
        wUnits: 'px',
        hUnits: 'px',
      });
    });

    it('should return null for invalid ICO', () => {
      const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      const result = parseICO(invalidBuffer);
      expect(result).toBeNull();
    });

    it('should reject a truncated icon directory', () => {
      const truncated = Buffer.from([0, 0, 1, 0, 2, 0, ...Buffer.alloc(16)]);

      expect(parseICO(truncated)).toBeNull();
    });
  });

  describe('parseImage', () => {
    it('should detect and parse different image formats', () => {
      // Test JPEG
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff]);
      const jpegResult = parseImage(jpegBuffer);
      expect(jpegResult).toBeNull(); // Minimal header, will fail detailed parsing

      // Test PNG signature
      const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const pngResult = parseImage(pngSignature);
      expect(pngResult).toBeNull(); // Just signature, no IHDR

      // Test GIF
      const gifBuffer = Buffer.from('GIF87a');
      const gifResult = parseImage(gifBuffer);
      expect(gifResult).toBeNull(); // Incomplete header
    });

    it('should return null for unknown format', () => {
      const unknownBuffer = Buffer.from([0x12, 0x34, 0x56, 0x78]);
      const result = parseImage(unknownBuffer);
      expect(result).toBeNull();
    });

    it('should handle parsing errors gracefully', () => {
      const corruptedBuffer = Buffer.from([0xff, 0xd8]); // Truncated JPEG
      const result = parseImage(corruptedBuffer);
      expect(result).toBeNull();
    });
  });
});
