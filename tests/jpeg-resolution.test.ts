import { describe, expect, it } from 'vitest';
import { parseJPEG } from '../src/parsers/jpeg.js';

const APP0 = 0xe0;
const APP1 = 0xe1;
const SOF = Buffer.from([
  0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x00, 0x01, 0x40, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00,
  0x03, 0x11, 0x00,
]);

function segment(marker: number, payload: Buffer, length = payload.length + 2): Buffer {
  return Buffer.concat([Buffer.from([0xff, marker, (length >> 8) & 0xff, length & 0xff]), payload]);
}

function jpeg(...parts: Buffer[]): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xd8]), ...parts, SOF]);
}

function jfif(units: number, xDensity: number, yDensity: number): Buffer {
  return Buffer.concat([
    Buffer.from('JFIF\0'),
    Buffer.from([
      0x01,
      0x02,
      units,
      (xDensity >> 8) & 0xff,
      xDensity & 0xff,
      (yDensity >> 8) & 0xff,
      yDensity & 0xff,
      0x00,
      0x00,
    ]),
  ]);
}

interface ExifOptions {
  byteOrder?: 'II' | 'MM' | 'ZZ';
  magic?: number;
  unit?: number;
  x?: readonly [number, number];
  y?: readonly [number, number];
  includeRationals?: boolean;
}

function exif({
  byteOrder = 'MM',
  magic = 42,
  unit = 2,
  x = [100, 1],
  y = [200, 1],
  includeRationals = true,
}: ExifOptions = {}): Buffer {
  const littleEndian = byteOrder === 'II';
  const tiff = Buffer.alloc(includeRationals ? 66 : 50);
  const writeUInt16 = littleEndian ? tiff.writeUInt16LE.bind(tiff) : tiff.writeUInt16BE.bind(tiff);
  const writeUInt32 = littleEndian ? tiff.writeUInt32LE.bind(tiff) : tiff.writeUInt32BE.bind(tiff);

  tiff.write(byteOrder, 0, 'ascii');
  writeUInt16(magic, 2);
  writeUInt32(8, 4);
  writeUInt16(3, 8);

  const writeEntry = (offset: number, tag: number, type: number, count: number, value: number) => {
    writeUInt16(tag, offset);
    writeUInt16(type, offset + 2);
    writeUInt32(count, offset + 4);
    writeUInt32(value, offset + 8);
  };

  writeEntry(10, 0x011a, 5, 1, 50);
  writeEntry(22, 0x011b, 5, 1, 58);
  writeEntry(34, 0x0128, 3, 1, littleEndian ? unit : unit << 16);
  writeUInt32(0, 46);

  if (includeRationals) {
    writeUInt32(x[0], 50);
    writeUInt32(x[1], 54);
    writeUInt32(y[0], 58);
    writeUInt32(y[1], 62);
  }

  return Buffer.concat([Buffer.from('Exif\0\0'), tiff]);
}

function bigEndianRationals(x: readonly [number, number], y: readonly [number, number]): Buffer {
  const values = Buffer.alloc(16);
  values.writeUInt32BE(x[0], 0);
  values.writeUInt32BE(x[1], 4);
  values.writeUInt32BE(y[0], 8);
  values.writeUInt32BE(y[1], 12);
  return values;
}

describe('JPEG resolution metadata', () => {
  it.each([
    { units: 0, expected: undefined },
    { units: 1, expected: { wResolution: 100, hResolution: 200 } },
    { units: 2, expected: { wResolution: 254, hResolution: 508 } },
  ])('handles JFIF density units $units', ({ units, expected }) => {
    const result = parseJPEG(jpeg(segment(APP0, jfif(units, 100, 200))));

    if (expected) {
      expect(result).toMatchObject(expected);
    } else {
      expect(result).not.toHaveProperty('wResolution');
      expect(result).not.toHaveProperty('hResolution');
    }
  });

  it('ignores zero JFIF density so a later valid segment can be used', () => {
    const result = parseJPEG(jpeg(segment(APP0, jfif(1, 0, 0)), segment(APP0, jfif(1, 72, 144))));

    expect(result).toMatchObject({ wResolution: 72, hResolution: 144 });
  });

  it('does not read JFIF density beyond a short APP0 segment', () => {
    const followingPayload = Buffer.concat([Buffer.from([72, 0, 72, 0, 0]), Buffer.alloc(249)]);
    const result = parseJPEG(
      jpeg(segment(APP0, Buffer.from('JFIF\0'), 7), segment(APP0, followingPayload, 256))
    );

    expect(result).not.toHaveProperty('wResolution');
    expect(result).not.toHaveProperty('hResolution');
  });

  it.each([
    { byteOrder: 'MM' as const, unit: 2, expected: [100, 200] },
    { byteOrder: 'II' as const, unit: 3, expected: [254, 508] },
  ])('parses $byteOrder EXIF resolution', ({ byteOrder, unit, expected }) => {
    const result = parseJPEG(jpeg(segment(APP1, exif({ byteOrder, unit }))));

    expect(result).toMatchObject({ wResolution: expected[0], hResolution: expected[1] });
  });

  it.each([
    { byteOrder: 'ZZ' as const, magic: 42 },
    { byteOrder: 'MM' as const, magic: 0 },
  ])('rejects an invalid EXIF TIFF header', ({ byteOrder, magic }) => {
    const result = parseJPEG(jpeg(segment(APP1, exif({ byteOrder, magic }))));

    expect(result).not.toHaveProperty('wResolution');
    expect(result).not.toHaveProperty('hResolution');
  });

  it('rejects a zero EXIF rational denominator', () => {
    const result = parseJPEG(jpeg(segment(APP1, exif({ x: [100, 0] }))));

    expect(result).not.toHaveProperty('wResolution');
    expect(result).not.toHaveProperty('hResolution');
  });

  it('does not follow EXIF rational offsets beyond APP1', () => {
    const result = parseJPEG(
      jpeg(segment(APP1, exif({ includeRationals: false })), bigEndianRationals([100, 1], [200, 1]))
    );

    expect(result).not.toHaveProperty('wResolution');
    expect(result).not.toHaveProperty('hResolution');
  });

  it('prefers valid EXIF resolution over JFIF resolution', () => {
    const result = parseJPEG(
      jpeg(segment(APP0, jfif(1, 72, 72)), segment(APP1, exif({ x: [300, 1], y: [300, 1] })))
    );

    expect(result).toMatchObject({ wResolution: 300, hResolution: 300 });
  });
});
