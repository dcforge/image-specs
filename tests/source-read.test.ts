import { open } from 'fs/promises';
import type { FileHandle } from 'fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseImage } from '../src/parsers/index.js';
import { detectFormat } from '../src/utils/detector.js';

vi.mock('fs/promises', () => ({ open: vi.fn() }));
vi.mock('../src/parsers/index.js', () => ({ parseImage: vi.fn() }));
vi.mock('../src/utils/detector.js', () => ({
  detectFormat: vi.fn(),
  getImageType: vi.fn(),
}));

import { getImageSpecs, isImageSource } from '../src/index.js';

const parsedImage = { width: 1, height: 1, type: 'png', mime: 'image/png' };

function mockFile(contents: Buffer) {
  const read = vi.fn(async (buffer: Buffer, offset: number, length: number, position: number) => {
    const end = Math.min(position + length, contents.length);
    contents.copy(buffer, offset, position, end);
    return { bytesRead: end - position, buffer };
  });
  const stat = vi.fn(async () => ({ size: contents.length }));
  const close = vi.fn(async () => undefined);

  vi.mocked(open).mockResolvedValue({ read, stat, close } as unknown as FileHandle);
  return { read, stat, close };
}

function firstBuffer(calls: readonly (readonly unknown[])[]): Buffer {
  const buffer = calls[0]?.[0];
  if (!Buffer.isBuffer(buffer)) throw new Error('Expected a Buffer argument');
  return buffer;
}

describe('bounded source reads', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(parseImage).mockReturnValue(parsedImage);
    vi.mocked(detectFormat).mockReturnValue(parseImage);
  });

  it('passes a zero-copy capped Buffer view to the parser', async () => {
    const source = Buffer.alloc(4096, 0xab);

    await getImageSpecs(source, { maxBytes: 64 });

    const parsed = firstBuffer(vi.mocked(parseImage).mock.calls);
    expect(parsed).toHaveLength(64);
    expect(parsed.buffer).toBe(source.buffer);
    expect(parsed.byteOffset).toBe(source.byteOffset);
  });

  it('decodes only a bounded data URL prefix', async () => {
    const source = Buffer.alloc(1024 * 1024, 0xab);
    const dataUrl = `data:image/png;base64,${source.toString('base64')}`;

    await getImageSpecs(dataUrl, { maxBytes: 64 });

    const parsed = firstBuffer(vi.mocked(parseImage).mock.calls);
    expect(parsed).toEqual(source.subarray(0, 64));
    expect(parsed.buffer.byteLength).toBeLessThan(source.length);
  });

  it('reads no more than maxBytes from a local file', async () => {
    const file = mockFile(Buffer.alloc(4096, 0xab));

    await getImageSpecs('/tmp/large.png', { maxBytes: 64 });

    expect(file.stat).toHaveBeenCalledOnce();
    expect(file.read).toHaveBeenCalledWith(expect.any(Buffer), 0, 64, 0);
    expect(file.close).toHaveBeenCalledOnce();
    expect(firstBuffer(vi.mocked(parseImage).mock.calls)).toHaveLength(64);
  });

  it('limits Buffer detection to DETECTION_BYTES without copying', async () => {
    const source = Buffer.alloc(4096, 0xab);

    await expect(isImageSource(source)).resolves.toBe(true);

    const detected = firstBuffer(vi.mocked(detectFormat).mock.calls);
    expect(detected).toHaveLength(1024);
    expect(detected.buffer).toBe(source.buffer);
    expect(detected.byteOffset).toBe(source.byteOffset);
  });

  it('limits data URL detection and its backing allocation', async () => {
    const source = Buffer.alloc(1024 * 1024, 0xab);
    const dataUrl = `data:image/png;base64,${source.toString('base64')}`;

    await expect(isImageSource(dataUrl)).resolves.toBe(true);

    const detected = firstBuffer(vi.mocked(detectFormat).mock.calls);
    expect(detected).toEqual(source.subarray(0, 1024));
    expect(detected.buffer.byteLength).toBeLessThan(source.length);
  });

  it('reads only DETECTION_BYTES from a local file during detection', async () => {
    const file = mockFile(Buffer.alloc(4096, 0xab));

    await expect(isImageSource('/tmp/large.png')).resolves.toBe(true);

    expect(file.read).toHaveBeenCalledWith(expect.any(Buffer), 0, 1024, 0);
    expect(file.close).toHaveBeenCalledOnce();
    expect(firstBuffer(vi.mocked(detectFormat).mock.calls)).toHaveLength(1024);
  });
});
