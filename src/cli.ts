#!/usr/bin/env node
import process from 'process';
import { realpathSync } from 'fs';
import { pathToFileURL } from 'url';
import { getImageSpecs, getImageSpecsBatch, isImageSource, ImageSpecsError } from './index.js';
import {
  PACKAGE_NAME,
  PACKAGE_VERSION,
  type ImageSpecs,
  type ImageSpecsOptions,
  type ImageSource,
} from './types.js';

/**
 * CLI configuration
 */
interface CliOptions extends ImageSpecsOptions {
  help?: boolean;
  version?: boolean;
  json?: boolean;
  batch?: boolean;
  check?: boolean;
  verbose?: boolean;
  silent?: boolean;
}

/**
 * CLI help text
 */
const HELP_TEXT = `
${PACKAGE_NAME} v${PACKAGE_VERSION}

Extract image specifications from URLs, files, or streams.

USAGE:
  image-specs [OPTIONS] <source>...

SOURCES:
  URL                     HTTP/HTTPS image URL
  FILE                    Local image file path
  -                       Read from stdin

OPTIONS:
  -h, --help              Show this help message
  -v, --version           Show version number
  -j, --json              Output results as JSON
  -b, --batch             Process multiple sources concurrently
  -c, --check             Only check if source is a valid image
  --timeout <ms>          Request timeout in milliseconds (default: 10000)
  --max-bytes <bytes>     Maximum bytes to read (default: 65536)
  --user-agent <string>   Custom User-Agent header
  --verbose               Show verbose output
  --silent                Suppress error messages

EXAMPLES:
  # Single image from URL
  image-specs https://example.com/image.jpg

  # Local image file
  image-specs ./photo.png

  # Multiple images in batch mode
  image-specs --batch img1.jpg img2.png https://example.com/img3.gif

  # Check if source is an image
  image-specs --check unknown-file.bin

  # JSON output
  image-specs --json image.webp

  # From stdin
  curl -s https://example.com/image.jpg | image-specs -

  # With custom options
  image-specs --timeout 5000 --user-agent "MyApp/1.0" https://example.com/image.avif
`;

/**
 * Parse command line arguments
 */
export function parseArgs(args: string[]): { options: CliOptions; sources: string[] } {
  const options: CliOptions = {};
  const sources: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg === '-h' || arg === '--help') {
      options.help = true;
    } else if (arg === '-v' || arg === '--version') {
      options.version = true;
    } else if (arg === '-j' || arg === '--json') {
      options.json = true;
    } else if (arg === '-b' || arg === '--batch') {
      options.batch = true;
    } else if (arg === '-c' || arg === '--check') {
      options.check = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--silent') {
      options.silent = true;
    } else if (arg === '--timeout') {
      options.timeout = parsePositiveInteger(args[++i], '--timeout');
    } else if (arg === '--max-bytes') {
      options.maxBytes = parsePositiveInteger(args[++i], '--max-bytes');
    } else if (arg === '--user-agent') {
      i++;
      const value = args[i];
      if (!value) {
        throw new Error('--user-agent requires a value');
      }
      options.userAgent = value;
    } else if (arg !== '-' && arg.startsWith('-')) {
      // A bare '-' is the stdin source, not an option
      throw new Error(`Unknown option: ${arg}`);
    } else {
      sources.push(arg);
    }
  }

  return { options, sources };
}

function parsePositiveInteger(value: string | undefined, option: string): number {
  const parsed = Number(value);
  if (!value || !Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${option} requires a numeric value`);
  }
  return parsed;
}

/**
 * Resolve an input argument to an image source. Anything but `-` is passed
 * through as a string for getImageSpecs to interpret as a URL or file path.
 */
function getImageSource(input: string): ImageSource {
  if (input !== '-') {
    return input;
  }

  if (!process.stdin.readable) {
    throw new Error('stdin is not readable');
  }

  return process.stdin;
}

type BatchResult =
  { success: true; specs: ImageSpecs } | { success: false; error: ImageSpecsError };

/**
 * Format single ImageSpecs output
 */
function formatSingleSpecs(specs: ImageSpecs, options: CliOptions): string {
  let output = `${specs.width}x${specs.height} ${specs.type} (${specs.mime})`;

  if (options.verbose) {
    output += `\n  Units: ${specs.wUnits} x ${specs.hUnits}`;
    if (specs.wResolution ?? specs.hResolution) {
      output += `\n  Resolution: ${specs.wResolution ?? 'N/A'} x ${specs.hResolution ?? 'N/A'} DPI`;
    }
    if (specs.colorSpace) {
      output += `\n  Color Space: ${specs.colorSpace}`;
    }
    if (specs.iccProfile) {
      output += `\n  ICC Profile: ${specs.iccProfile}`;
    }
    if (specs.bitDepth) {
      output += `\n  Bit Depth: ${specs.bitDepth}`;
    }
    if (specs.channels) {
      output += `\n  Channels: ${specs.channels}`;
    }
    if (specs.gamma) {
      output += `\n  Gamma: ${specs.gamma}`;
    }
    if (specs.url) {
      output += `\n  URL: ${specs.url}`;
    }
    if (specs.path) {
      output += `\n  Path: ${specs.path}`;
    }
    if (specs.filename) {
      output += `\n  Filename: ${specs.filename}`;
    }
  }

  return output;
}

/**
 * Format batch results output
 */
function formatBatchResults(results: BatchResult[], options: CliOptions): string {
  if (options.json) {
    return JSON.stringify(results, null, 2);
  }

  return results
    .map((result, index) => {
      if (result.success) {
        const specs = result.specs;
        return `[${index}] ${specs.width}x${specs.height} ${specs.type} (${specs.mime})${specs.url ? ` - ${specs.url}` : ''}`;
      } else {
        return `[${index}] Error: ${result.error.message}`;
      }
    })
    .join('\n');
}

/**
 * Format boolean or boolean array output
 */
function formatBooleanOutput(data: boolean | boolean[], options: CliOptions): string {
  if (options.json) {
    return JSON.stringify(data, null, 2);
  }

  if (Array.isArray(data)) {
    return data.map((val, idx) => `[${idx}] ${val}`).join('\n');
  }

  return data ? 'true' : 'false';
}

/**
 * Log error if not silent
 */
function logError(message: string, options: CliOptions): void {
  if (!options.silent) {
    console.error(message);
  }
}

/**
 * Main CLI function
 */
async function main(): Promise<void> {
  let options: CliOptions = {};

  try {
    const parsed = parseArgs(process.argv.slice(2));
    options = parsed.options;
    const sources = parsed.sources;

    // Handle help and version
    if (options.help) {
      process.stdout.write(`${HELP_TEXT}\n`);
      return;
    }

    if (options.version) {
      process.stdout.write(`${PACKAGE_VERSION}\n`);
      return;
    }

    // Validate sources
    if (sources.length === 0) {
      throw new Error('No sources provided. Use --help for usage information.');
    }

    // Process sources
    if (options.batch && sources.length > 1) {
      // Batch processing
      const imageSources = sources.map(getImageSource);

      if (options.check) {
        const results = await Promise.all(
          imageSources.map((source) => isImageSource(source, options))
        );
        process.stdout.write(`${formatBooleanOutput(results, options)}\n`);
      } else {
        const results = await getImageSpecsBatch(imageSources, options);
        process.stdout.write(`${formatBatchResults(results, options)}\n`);
      }
    } else {
      // Single source processing
      const source = sources[0];
      if (!source) {
        throw new Error('No sources provided. Use --help for usage information.');
      }
      const imageSource = getImageSource(source);

      if (options.check) {
        const result = await isImageSource(imageSource, options);
        process.stdout.write(`${formatBooleanOutput(result, options)}\n`);
      } else {
        const specs = await getImageSpecs(imageSource, options);
        if (options.json) {
          process.stdout.write(`${JSON.stringify(specs, null, 2)}\n`);
        } else {
          process.stdout.write(`${formatSingleSpecs(specs, options)}\n`);
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const prefix = error instanceof ImageSpecsError ? `Error [${error.code}]` : 'Error';

    logError(`${prefix}: ${message}`, options);
    process.exitCode = 1;
  }
}

/**
 * True when this module is the process entry point.
 *
 * `import.meta.url` is always a fully resolved, percent-encoded file URL, so
 * argv[1] has to be normalised the same way before comparing: npm installs bin
 * entries as symlinks (hence realpathSync) and a plain `file://${path}`
 * template leaves spaces unencoded.
 */
function isEntryPoint(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }

  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  main().catch((error) => {
    console.error('Unexpected error:', error);
    process.exitCode = 1;
  });
}
