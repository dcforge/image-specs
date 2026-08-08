import { describe, it, expect } from 'vitest';
import { parseJPEG } from '../src/parsers/jpeg.js';
import { parsePNG } from '../src/parsers/png.js';

describe('Color Space and ICC Profile Tests', () => {
  describe('JPEG Color Space', () => {
    it('should detect Adobe RGB from APP14 segment', () => {
      // Create a minimal JPEG with Adobe APP14 segment
      const jpegBuffer = Buffer.concat([
        // SOI
        Buffer.from([0xff, 0xd8]),

        // APP14 (Adobe)
        Buffer.from([0xff, 0xee]),
        Buffer.from([0x00, 0x0e]), // Length (14)
        Buffer.from('Adobe'), // Adobe marker
        Buffer.from([0x00, 0x64]), // Version
        Buffer.from([0x40, 0x00]), // Flags0
        Buffer.from([0x00, 0x00]), // Flags1
        Buffer.from([0x00]), // Transform (0 = Unknown/RGB)

        // SOF0
        Buffer.from([0xff, 0xc0]),
        Buffer.from([0x00, 0x11]), // Length
        Buffer.from([0x08]), // Precision
        Buffer.from([0x00, 0x64]), // Height (100)
        Buffer.from([0x00, 0x64]), // Width (100)
        Buffer.from([0x03]), // Components
        // Component data (minimal)
        Buffer.from([0x01, 0x11, 0x00]),
        Buffer.from([0x02, 0x11, 0x00]),
        Buffer.from([0x03, 0x11, 0x00]),
      ]);

      const result = parseJPEG(jpegBuffer);
      expect(result).toBeTruthy();
      expect(result?.colorSpace).toBe('Adobe RGB');
    });

    it('should detect YCbCr from Adobe APP14 segment', () => {
      // Create a minimal JPEG with Adobe APP14 segment indicating YCbCr
      const jpegBuffer = Buffer.concat([
        // SOI
        Buffer.from([0xff, 0xd8]),

        // APP14 (Adobe)
        Buffer.from([0xff, 0xee]),
        Buffer.from([0x00, 0x0e]), // Length (14)
        Buffer.from('Adobe'), // Adobe marker
        Buffer.from([0x00, 0x64]), // Version
        Buffer.from([0x40, 0x00]), // Flags0
        Buffer.from([0x00, 0x00]), // Flags1
        Buffer.from([0x01]), // Transform (1 = YCbCr)

        // SOF0
        Buffer.from([0xff, 0xc0]),
        Buffer.from([0x00, 0x11]), // Length
        Buffer.from([0x08]), // Precision
        Buffer.from([0x00, 0x64]), // Height (100)
        Buffer.from([0x00, 0x64]), // Width (100)
        Buffer.from([0x03]), // Components
        // Component data (minimal)
        Buffer.from([0x01, 0x11, 0x00]),
        Buffer.from([0x02, 0x11, 0x00]),
        Buffer.from([0x03, 0x11, 0x00]),
      ]);

      const result = parseJPEG(jpegBuffer);
      expect(result).toBeTruthy();
      expect(result?.colorSpace).toBe('YCbCr');
    });

    it('should extract bit depth and channels from SOF', () => {
      // Create a minimal JPEG with SOF0
      const jpegBuffer = Buffer.concat([
        // SOI
        Buffer.from([0xff, 0xd8]),

        // SOF0
        Buffer.from([0xff, 0xc0]),
        Buffer.from([0x00, 0x11]), // Length
        Buffer.from([0x08]), // Precision (8-bit)
        Buffer.from([0x00, 0x64]), // Height (100)
        Buffer.from([0x00, 0x64]), // Width (100)
        Buffer.from([0x03]), // Components (3 channels)
        // Component data (minimal)
        Buffer.from([0x01, 0x11, 0x00]),
        Buffer.from([0x02, 0x11, 0x00]),
        Buffer.from([0x03, 0x11, 0x00]),
      ]);

      const result = parseJPEG(jpegBuffer);
      expect(result).toBeTruthy();
      expect(result?.bitDepth).toBe(8);
      expect(result?.channels).toBe(3);
    });

    it('should detect embedded ICC profile', () => {
      // Create a minimal JPEG with ICC profile APP2 segment
      const jpegBuffer = Buffer.concat([
        // SOI
        Buffer.from([0xff, 0xd8]),

        // APP2 (ICC Profile)
        Buffer.from([0xff, 0xe2]),
        Buffer.from([0x00, 0x24]), // Length (36 = 14 + 2 + 20)
        Buffer.from('ICC_PROFILE\0'),
        Buffer.from([0x01, 0x01]), // Chunk 1 of 1
        // Minimal ICC data with sRGB marker (must be lowercase for detection)
        Buffer.from('test srgb icc profile'),

        // SOF0
        Buffer.from([0xff, 0xc0]),
        Buffer.from([0x00, 0x11]), // Length
        Buffer.from([0x08]), // Precision
        Buffer.from([0x00, 0x64]), // Height (100)
        Buffer.from([0x00, 0x64]), // Width (100)
        Buffer.from([0x03]), // Components
        // Component data (minimal)
        Buffer.from([0x01, 0x11, 0x00]),
        Buffer.from([0x02, 0x11, 0x00]),
        Buffer.from([0x03, 0x11, 0x00]),
      ]);

      const result = parseJPEG(jpegBuffer);
      expect(result).toBeTruthy();
      // The test ICC profile contains 'srgb' which is detected
      expect(result?.colorSpace).toBe('sRGB');
      expect(result?.iccProfile).toBe('sRGB');
    });
  });

  describe('PNG Color Space', () => {
    it('should detect sRGB chunk', () => {
      // Create a minimal PNG with sRGB chunk
      const pngBuffer = Buffer.concat([
        // PNG signature
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),

        // IHDR chunk
        Buffer.from([0x00, 0x00, 0x00, 0x0d]), // Length (13)
        Buffer.from('IHDR'),
        Buffer.from([0x00, 0x00, 0x00, 0x64]), // Width (100)
        Buffer.from([0x00, 0x00, 0x00, 0x64]), // Height (100)
        Buffer.from([0x08]), // Bit depth
        Buffer.from([0x02]), // Color type (RGB)
        Buffer.from([0x00, 0x00, 0x00]), // Compression, filter, interlace
        Buffer.from([0x00, 0x00, 0x00, 0x00]), // CRC (dummy)

        // sRGB chunk
        Buffer.from([0x00, 0x00, 0x00, 0x01]), // Length (1)
        Buffer.from('sRGB'),
        Buffer.from([0x00]), // Rendering intent
        Buffer.from([0x00, 0x00, 0x00, 0x00]), // CRC (dummy)

        // IEND chunk
        Buffer.from([0x00, 0x00, 0x00, 0x00]), // Length (0)
        Buffer.from('IEND'),
        Buffer.from([0x00, 0x00, 0x00, 0x00]), // CRC (dummy)
      ]);

      const result = parsePNG(pngBuffer);
      expect(result).toBeTruthy();
      expect(result?.colorSpace).toBe('sRGB');
    });

    it('should extract gamma value', () => {
      // Create a minimal PNG with gAMA chunk
      const pngBuffer = Buffer.concat([
        // PNG signature
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),

        // IHDR chunk
        Buffer.from([0x00, 0x00, 0x00, 0x0d]), // Length (13)
        Buffer.from('IHDR'),
        Buffer.from([0x00, 0x00, 0x00, 0x64]), // Width (100)
        Buffer.from([0x00, 0x00, 0x00, 0x64]), // Height (100)
        Buffer.from([0x08]), // Bit depth
        Buffer.from([0x02]), // Color type (RGB)
        Buffer.from([0x00, 0x00, 0x00]), // Compression, filter, interlace
        Buffer.from([0x00, 0x00, 0x00, 0x00]), // CRC (dummy)

        // gAMA chunk
        Buffer.from([0x00, 0x00, 0x00, 0x04]), // Length (4)
        Buffer.from('gAMA'),
        Buffer.from([0x00, 0x00, 0xb1, 0x8f]), // Gamma 45455 = 2.2
        Buffer.from([0x00, 0x00, 0x00, 0x00]), // CRC (dummy)

        // IEND chunk
        Buffer.from([0x00, 0x00, 0x00, 0x00]), // Length (0)
        Buffer.from('IEND'),
        Buffer.from([0x00, 0x00, 0x00, 0x00]), // CRC (dummy)
      ]);

      const result = parsePNG(pngBuffer);
      expect(result).toBeTruthy();
      // PNG stores gamma as 1/gamma * 100000, so 45455 means gamma = 2.2
      expect(result?.gamma).toBeCloseTo(0.45455, 1);
    });

    it('should extract bit depth and channels from IHDR', () => {
      // Create a minimal PNG
      const pngBuffer = Buffer.concat([
        // PNG signature
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),

        // IHDR chunk
        Buffer.from([0x00, 0x00, 0x00, 0x0d]), // Length (13)
        Buffer.from('IHDR'),
        Buffer.from([0x00, 0x00, 0x00, 0x64]), // Width (100)
        Buffer.from([0x00, 0x00, 0x00, 0x64]), // Height (100)
        Buffer.from([0x10]), // Bit depth (16)
        Buffer.from([0x06]), // Color type (RGBA)
        Buffer.from([0x00, 0x00, 0x00]), // Compression, filter, interlace
        Buffer.from([0x00, 0x00, 0x00, 0x00]), // CRC (dummy)

        // IEND chunk
        Buffer.from([0x00, 0x00, 0x00, 0x00]), // Length (0)
        Buffer.from('IEND'),
        Buffer.from([0x00, 0x00, 0x00, 0x00]), // CRC (dummy)
      ]);

      const result = parsePNG(pngBuffer);
      expect(result).toBeTruthy();
      expect(result?.bitDepth).toBe(16);
      expect(result?.channels).toBe(4); // RGBA
    });

    it('should extract ICC profile name', () => {
      // Create a minimal PNG with iCCP chunk
      const pngBuffer = Buffer.concat([
        // PNG signature
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),

        // IHDR chunk
        Buffer.from([0x00, 0x00, 0x00, 0x0d]), // Length (13)
        Buffer.from('IHDR'),
        Buffer.from([0x00, 0x00, 0x00, 0x64]), // Width (100)
        Buffer.from([0x00, 0x00, 0x00, 0x64]), // Height (100)
        Buffer.from([0x08]), // Bit depth
        Buffer.from([0x02]), // Color type (RGB)
        Buffer.from([0x00, 0x00, 0x00]), // Compression, filter, interlace
        Buffer.from([0x00, 0x00, 0x00, 0x00]), // CRC (dummy)

        // iCCP chunk
        Buffer.from([0x00, 0x00, 0x00, 0x14]), // Length (20)
        Buffer.from('iCCP'),
        Buffer.from('Display P3\0'), // Profile name
        Buffer.from([0x00]), // Compression method
        Buffer.from('profile'), // Compressed profile (dummy)
        Buffer.from([0x00, 0x00, 0x00, 0x00]), // CRC (dummy)

        // IEND chunk
        Buffer.from([0x00, 0x00, 0x00, 0x00]), // Length (0)
        Buffer.from('IEND'),
        Buffer.from([0x00, 0x00, 0x00, 0x00]), // CRC (dummy)
      ]);

      const result = parsePNG(pngBuffer);
      expect(result).toBeTruthy();
      expect(result?.iccProfile).toBe('Display P3');
    });
  });
});
