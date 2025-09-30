import { describe, it, expect } from 'vitest';
import { detectFormat, getImageType, mightBeImage } from '../src/utils/detector.js';
import { parseJPEG, parsePNG, parseGIF } from '../src/parsers/index.js';

describe('Image Detector', () => {
  describe('mightBeImage', () => {
    it('should quickly identify potential JPEG', () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff]);
      expect(mightBeImage(jpegBuffer)).toBe(true);
    });

    it('should quickly identify potential PNG', () => {
      const pngBuffer = Buffer.from([0x89, 0x50]);
      expect(mightBeImage(pngBuffer)).toBe(true);
    });

    it('should quickly identify potential GIF', () => {
      const gifBuffer = Buffer.from([0x47, 0x49]); // 'GI'
      expect(mightBeImage(gifBuffer)).toBe(true);
    });

    it('should reject non-image buffers', () => {
      const textBuffer = Buffer.from('Hello World');
      expect(mightBeImage(textBuffer)).toBe(false);
    });

    it('should reject too small buffers', () => {
      const smallBuffer = Buffer.from([0xff]);
      expect(mightBeImage(smallBuffer)).toBe(false);
    });
  });

  describe('detectFormat', () => {
    it('should detect JPEG format', () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      const parser = detectFormat(jpegBuffer);
      expect(parser).toBe(parseJPEG);
    });

    it('should detect PNG format', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const parser = detectFormat(pngBuffer);
      expect(parser).toBe(parsePNG);
    });

    it('should detect GIF89a format', () => {
      const gifBuffer = Buffer.from('GIF89a');
      const parser = detectFormat(gifBuffer);
      expect(parser).toBe(parseGIF);
    });

    it('should detect GIF87a format', () => {
      const gifBuffer = Buffer.from('GIF87a');
      const parser = detectFormat(gifBuffer);
      expect(parser).toBe(parseGIF);
    });

    it('should return null for unknown formats', () => {
      const unknownBuffer = Buffer.from('UNKNOWN');
      const parser = detectFormat(unknownBuffer);
      expect(parser).toBeNull();
    });
  });

  describe('getImageType', () => {
    it('should return jpg for JPEG', () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8]);
      expect(getImageType(jpegBuffer)).toBe('jpg');
    });

    it('should return png for PNG', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(getImageType(pngBuffer)).toBe('png');
    });

    it('should return gif for GIF', () => {
      const gifBuffer = Buffer.from('GIF89a');
      expect(getImageType(gifBuffer)).toBe('gif');
    });

    it('should return bmp for BMP', () => {
      const bmpBuffer = Buffer.from([0x42, 0x4d]); // 'BM'
      expect(getImageType(bmpBuffer)).toBe('bmp');
    });

    it('should return ico for ICO', () => {
      const icoBuffer = Buffer.from([0x00, 0x00, 0x01, 0x00]);
      expect(getImageType(icoBuffer)).toBe('ico');
    });

    it('should return webp for WebP', () => {
      const webpBuffer = Buffer.concat([
        Buffer.from('RIFF'),
        Buffer.from([0x00, 0x00, 0x00, 0x00]),
        Buffer.from('WEBP'),
      ]);
      expect(getImageType(webpBuffer)).toBe('webp');
    });

    it('should return svg for SVG', () => {
      const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">');
      expect(getImageType(svgBuffer)).toBe('svg');
    });

    it('should return null for unknown formats', () => {
      const unknownBuffer = Buffer.from('UNKNOWN');
      expect(getImageType(unknownBuffer)).toBeNull();
    });
  });
});
