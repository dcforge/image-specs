import { describe, it, expect } from 'vitest';
import {
  parseJPEG,
  parsePNG,
  parseGIF,
  parseBMP,
  parseSVG,
  parseICO,
  parseImage,
} from '../src/parsers/index.js';

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
