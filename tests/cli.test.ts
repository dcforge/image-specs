import { describe, it, expect } from 'vitest';
import { parseArgs } from '../src/cli.js';

describe('CLI argument parsing', () => {
  it('should treat a bare dash as the stdin source, not an option', () => {
    const { sources, options } = parseArgs(['-']);
    expect(sources).toEqual(['-']);
    expect(options.help).toBeUndefined();
  });

  it('should accept a bare dash alongside flags', () => {
    const { sources, options } = parseArgs(['--json', '-']);
    expect(sources).toEqual(['-']);
    expect(options.json).toBe(true);
  });

  it('should still reject unknown options', () => {
    expect(() => parseArgs(['--nope'])).toThrow('Unknown option: --nope');
    expect(() => parseArgs(['-x'])).toThrow('Unknown option: -x');
  });

  it('should collect file and URL sources', () => {
    const { sources } = parseArgs(['a.png', 'https://example.com/b.jpg']);
    expect(sources).toEqual(['a.png', 'https://example.com/b.jpg']);
  });

  it('should parse valued options', () => {
    const { options } = parseArgs([
      '--timeout',
      '5000',
      '--max-bytes',
      '1024',
      '--user-agent',
      'x',
    ]);
    expect(options.timeout).toBe(5000);
    expect(options.maxBytes).toBe(1024);
    expect(options.userAgent).toBe('x');
  });

  it('should reject valued options with missing or non-numeric values', () => {
    expect(() => parseArgs(['--timeout'])).toThrow('--timeout requires a numeric value');
    expect(() => parseArgs(['--max-bytes', 'abc'])).toThrow('--max-bytes requires a numeric value');
    expect(() => parseArgs(['--user-agent'])).toThrow('--user-agent requires a value');
  });
});
