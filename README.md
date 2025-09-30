# image-specs

[![npm version](https://badge.fury.io/js/image-specs.svg)](https://badge.fury.io/js/@dcforge/image-specs)
[![TypeScript](https://badges.frapsoft.com/typescript/love/typescript.svg?v=101)](https://github.com/ellerbrock/typescript-badges/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern TypeScript library for extracting image specifications from URLs, streams, or buffers. Intelligently reads only the minimum bytes needed (typically just the file header) to extract metadata, making it extremely fast even with large images. Supports all major image formats with zero dependencies and provides both ESM and CommonJS builds.

## ✨ Features

- 🚀 **Zero Dependencies** - Lightweight and fast
- 🔧 **TypeScript First** - Full type safety and IntelliSense support
- 📦 **Dual Package** - ESM and CommonJS builds
- 🌐 **URL Support** - Fetch images from HTTP/HTTPS URLs
- 📊 **Stream Support** - Process images from readable streams
- 🎯 **Format Detection** - Automatic image format detection
- 🔍 **Metadata Extraction** - Resolution, dimensions, color space, ICC profiles, and more
- ⚡ **Smart Performance** - Reads only necessary bytes (default: 64KB max) to extract metadata
- 🎨 **Efficient Parsing** - Uses optimized BitReader and BufferReader utilities
- 🛡️ **Error Handling** - Comprehensive error types and messages
- 📱 **CLI Tool** - Command-line interface included

## 🖼️ Supported Formats

### Quick Overview

| Format | Extension | MIME Type | Detection | Basic Specs |
|--------|-----------|-----------|:---------:|:-----------:|
| JPEG | `.jpg`, `.jpeg` | `image/jpeg` | ✅ | ✅ |
| PNG | `.png` | `image/png` | ✅ | ✅ |
| GIF | `.gif` | `image/gif` | ✅ | ✅ |
| WebP | `.webp` | `image/webp` | ✅ | ✅ |
| BMP | `.bmp` | `image/bmp` | ✅ | ✅ |
| SVG | `.svg` | `image/svg+xml` | ✅ | ✅ |
| AVIF | `.avif` | `image/avif` | ✅ | ✅ |
| ICO | `.ico` | `image/x-icon` | ✅ | ✅ |

### Detailed Metadata Support

| Format | Dimensions | DPI/Resolution | Color Space | ICC Profile | Bit Depth | Channels | Gamma | Units |
|--------|:----------:|:--------------:|:-----------:|:-----------:|:---------:|:--------:|:-----:|:-----:|
| **JPEG** | ✅ | ✅ JFIF/EXIF | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ |
| **PNG** | ✅ | ✅ pHYs chunk | ✅ | ✅ | ✅ | ✅ | ✅ | ✅* |
| **GIF** | ✅ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **WebP** | ✅ | ✗ | ✅ | ✅ | ✗ | ✅ | ✗ | ✗ |
| **BMP** | ✅ | ✅ | ✗ | ✗ | ✅ | ✅ | ✗ | ✗ |
| **SVG** | ✅ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✅ |
| **AVIF** | ✅ | ✗ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ |
| **ICO** | ✅ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

**Legend:**
- ✅ Supported
- ✗ Not supported/Not applicable
- ✅* PNG dimensions are always in pixels; pHYs chunk provides resolution unit info (meters or unknown/aspect ratio)
- Resolution units: pixels per inch (DPI) or pixels per meter (PPM)

## 📦 Installation

```bash
npm install image-specs
```

```bash
yarn add image-specs
```

```bash
pnpm add image-specs
```

## 🚀 Quick Start

> **💡 Smart by Default**: The library automatically reads only the minimum bytes needed to extract metadata. You don't need to worry about downloading entire images - it typically reads just the first few KB of the file header, even for multi-GB images!

### Basic Usage

```typescript
import { getImageSpecs } from 'image-specs';

// From URL
const specs = await getImageSpecs('https://example.com/image.jpg');
console.log(`${specs.width}x${specs.height} ${specs.type}`);
console.log(`URL: ${specs.url}`); // https://example.com/image.jpg
console.log(`Filename: ${specs.filename}`); // image.jpg

// From local file path (direct)
const specs = await getImageSpecs('./photos/vacation.png');
console.log(`Path: ${specs.path}`); // ./photos/vacation.png
console.log(`Filename: ${specs.filename}`); // vacation.png

// From buffer
import { readFile } from 'fs/promises';
const buffer = await readFile('./image.png');
const specs = await getImageSpecs(buffer);
// Note: path and filename are not available when using Buffer

// From stream
import { createReadStream } from 'fs';
const stream = createReadStream('./image.gif');
const specs = await getImageSpecs(stream);
// Note: path and filename are not available when using Stream
```

### With Options

```typescript
const specs = await getImageSpecs('https://example.com/image.webp', {
  timeout: 5000,
  maxBytes: 32768,
  headers: {
    'User-Agent': 'MyApp/1.0'
  }
});
```

### Batch Processing

```typescript
import { getImageSpecsBatch } from 'image-specs';

const sources = [
  'https://example.com/image1.jpg',
  './local-image.png',
  buffer,
  stream
];

const results = await getImageSpecsBatch(sources);

results.forEach((result, index) => {
  if (result.success) {
    console.log(`Image ${index}: ${result.specs.width}x${result.specs.height}`);
  } else {
    console.error(`Image ${index} failed: ${result.error.message}`);
  }
});
```

### Format Checking

```typescript
import { isImageSource } from 'image-specs';

const isImage = await isImageSource('https://example.com/unknown-file');
if (isImage) {
  const specs = await getImageSpecs('https://example.com/unknown-file');
}
```

## 📋 API Reference

### `getImageSpecs(source, options?)`

Extract image specifications from a source.

**Parameters:**
- `source: ImageSource` - URL string, Buffer, or Readable stream
- `options?: ImageSpecsOptions` - Optional configuration

**Returns:** `Promise<ImageSpecs>`

```typescript
interface ImageSpecs {
  width: number;        // Image width in pixels or specified units
  height: number;       // Image height in pixels or specified units
  type: string;         // Image format (e.g., 'jpg', 'png')
  mime: string;         // MIME type (e.g., 'image/jpeg')
  wUnits: string;       // Width units (e.g., 'px', 'in', 'cm')
  hUnits: string;       // Height units (e.g., 'px', 'in', 'cm')
  wResolution?: number; // Width resolution in DPI/PPI
  hResolution?: number; // Height resolution in DPI/PPI
  url?: string;         // Original URL if source was a URL
  path?: string;        // File path if source was a local file
  filename?: string;    // Filename extracted from path or URL
  colorSpace?: string;  // Color space (e.g., 'sRGB', 'Adobe RGB', 'Display P3')
  iccProfile?: string;  // ICC profile name if embedded
  gamma?: number;       // Gamma value if specified
  bitDepth?: number;    // Bit depth per channel
  channels?: number;    // Number of color channels
}
```

### `getImageSpecsBatch(sources, options?)`

Process multiple image sources concurrently.

**Parameters:**
- `sources: ImageSource[]` - Array of sources to process
- `options?: ImageSpecsOptions` - Optional configuration

**Returns:** `Promise<BatchResult[]>`

### `isImageSource(source, options?)`

Check if a source appears to be a supported image format.

**Parameters:**
- `source: ImageSource` - Source to check
- `options?: ImageSpecsOptions` - Optional configuration

**Returns:** `Promise<boolean>`

### Options

```typescript
interface ImageSpecsOptions {
  timeout?: number;     // Request timeout in milliseconds (default: 10000)
  headers?: Record<string, string>; // HTTP headers
  maxBytes?: number;    // Maximum bytes to read (default: 65536 = 64KB)
                       // Note: The library only reads what's needed for metadata,
                       // typically much less than this limit
  userAgent?: string;   // User agent string
}
```

## 🖥️ CLI Usage

The package includes a command-line tool for extracting image specifications:

```bash
# Install globally
npm install -g image-specs

# Or use with npx
npx image-specs [options] <source>...
```

### CLI Examples

```bash
# Single image from URL
image-specs https://example.com/image.jpg

# Local image file
image-specs ./photo.png

# Multiple images in batch mode
image-specs --batch img1.jpg img2.png https://example.com/img3.gif

# JSON output (includes path/filename/url)
image-specs --json image.webp

# Verbose output (shows all metadata)
image-specs --verbose ./photo.jpg

# Check if source is an image
image-specs --check unknown-file.bin

# From stdin
curl -s https://example.com/image.jpg | image-specs -

# With custom options
image-specs --timeout 5000 --user-agent "MyApp/1.0" https://example.com/image.avif
```

### CLI Options

```bash
-h, --help              Show help message
-v, --version           Show version number
-j, --json              Output results as JSON
-b, --batch             Process multiple sources concurrently
-c, --check             Only check if source is a valid image
--timeout <ms>          Request timeout in milliseconds
--max-bytes <bytes>     Maximum bytes to read
--user-agent <string>   Custom User-Agent header
--verbose               Show verbose output
--silent                Suppress error messages
```

## 🎨 Color Space and ICC Profile Support

The library extracts color space and ICC profile information when available:

```typescript
const specs = await getImageSpecs('image-with-profile.jpg');

console.log(specs.colorSpace);  // 'Adobe RGB', 'sRGB', 'Display P3', etc.
console.log(specs.iccProfile);  // Profile name if embedded
console.log(specs.gamma);        // Gamma value if specified
console.log(specs.bitDepth);     // Bit depth per channel (e.g., 8, 16)
console.log(specs.channels);     // Number of channels (e.g., 3 for RGB, 4 for RGBA)
```

### Supported Color Spaces

- **sRGB** - Standard RGB color space
- **Adobe RGB** - Adobe RGB (1998) color space
- **Display P3** - Wide-gamut color space used by Apple devices
- **ProPhoto RGB** - Large gamut color space for professional photography
- **Rec. 2020** - Ultra-wide gamut for HDR video
- **YCbCr** - Component color space used in JPEG compression
- **CMYK** - Four-color printing color space
- **Grayscale** - Single channel grayscale
- **Lab** - Device-independent color space

## 🔧 Advanced Usage

### Data URLs

```typescript
const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
const specs = await getImageSpecs(dataUrl);
```

### Custom Stream Processing

```typescript
import { Readable } from 'stream';
import { parseImage } from 'image-specs';

const customStream = new Readable({
  read() {
    // Your custom stream logic
  }
});

const specs = await getImageSpecs(customStream);
```

### Error Handling

```typescript
import { ImageSpecsError, ErrorCodes } from 'image-specs';

try {
  const specs = await getImageSpecs('https://example.com/image.jpg');
} catch (error) {
  if (error instanceof ImageSpecsError) {
    switch (error.code) {
      case ErrorCodes.UNSUPPORTED_FORMAT:
        console.log('Image format not supported');
        break;
      case ErrorCodes.NETWORK_ERROR:
        console.log('Network error occurred');
        break;
      case ErrorCodes.TIMEOUT:
        console.log('Request timed out');
        break;
      default:
        console.log('Other error:', error.message);
    }
  }
}
```

### Performance Considerations

The library is designed to be fast and efficient by default:

- **Smart Reading**: Automatically reads only the necessary bytes to extract metadata (default max: 64KB)
- **Early Exit**: Stops reading as soon as all metadata is found
- **No Full Download**: Never downloads entire images unless explicitly configured

```typescript
// Default behavior - reads up to 64KB (sufficient for most metadata)
const specs = await getImageSpecs(source);

// For extremely limited bandwidth, you can reduce further
const specs = await getImageSpecs(source, {
  maxBytes: 8192  // Only read first 8KB
});

// For slow networks, adjust timeout
const specs = await getImageSpecs(source, {
  timeout: 30000  // 30 second timeout
});

// If you need to ensure even less data is read
const specs = await getImageSpecs(source, {
  maxBytes: 4096  // Only read first 4KB - enough for most formats
});
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

## 🏗️ Building

```bash
# Build the project
npm run build

# Build in development mode with watch
npm run dev

# Clean build directory
npm run clean
```

## 📊 Bundle Analysis

The package is optimized for minimal bundle size:

- **ESM build**: ~51KB (index.js)
- **CommonJS build**: ~57KB (index.cjs)
- **CLI tool**: ~53KB (cli.js) / ~58KB (cli.cjs)
- **Zero dependencies**
- **Tree-shakeable exports**
- **Full TypeScript definitions included**

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/dcforge/image-specs.git
cd image-specs

# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by [probe-image-size](https://github.com/nodeca/probe-image-size)
- Built with modern TypeScript and tooling
- Thanks to all contributors and users

## 📚 Related Projects

- [sharp](https://github.com/lovell/sharp) - High-performance image processing
- [jimp](https://github.com/oliver-moran/jimp) - JavaScript image manipulation
- [image-size](https://github.com/image-size/image-size) - Alternative image dimension detection

---

<div align="center">
  <strong>Made with ❤️ and TypeScript</strong>
</div>