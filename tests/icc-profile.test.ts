import { describe, it, expect } from 'vitest';
import { identifyIccProfile } from '../src/utils/color-space.js';

/**
 * Build a minimal ICC profile whose tagged element table points at a `desc`
 * record holding the given name.
 */
function iccProfileWithDescription(name: string): Buffer {
  const profile = Buffer.alloc(300);
  profile.write('desc', 132, 'ascii'); // Tag table entry signature
  profile.writeUInt32BE(160, 136); // Offset of the desc record
  profile.writeUInt32BE(60, 140); // Size of the desc record
  profile.writeUInt32BE(0x64657363, 160); // 'desc' type signature
  profile.writeUInt32BE(name.length + 1, 168); // ASCII length
  profile.write(`${name}\0`, 172, 'ascii');
  return profile;
}

describe('identifyIccProfile', () => {
  it('should read the profile description embedded in the desc tag', () => {
    expect(identifyIccProfile(iccProfileWithDescription('Totally Custom Profile'))).toEqual({
      iccProfile: 'Totally Custom Profile',
    });
  });

  it('should map well-known profile names to a color space', () => {
    expect(identifyIccProfile(iccProfileWithDescription('sRGB IEC61966-2.1'))).toEqual({
      iccProfile: 'sRGB IEC61966-2.1',
      colorSpace: 'sRGB',
    });
    expect(identifyIccProfile(iccProfileWithDescription('Adobe RGB (1998)'))).toEqual({
      iccProfile: 'Adobe RGB (1998)',
      colorSpace: 'Adobe RGB',
    });
  });

  // These two carry punctuation that the looser string matcher misses, so they
  // are the reason the profile table maps color spaces explicitly
  it('should resolve color spaces whose names defy loose string matching', () => {
    expect(identifyIccProfile(iccProfileWithDescription('Rec. 2020'))).toEqual({
      iccProfile: 'Rec. 2020',
      colorSpace: 'Rec. 2020',
    });
    expect(identifyIccProfile(iccProfileWithDescription('DCI-P3'))).toEqual({
      iccProfile: 'DCI-P3',
      colorSpace: 'DCI-P3',
    });
  });

  it('should fall back to scanning raw bytes when there is no desc record', () => {
    const profile = Buffer.concat([Buffer.alloc(60), Buffer.from('Display P3'), Buffer.alloc(200)]);
    expect(identifyIccProfile(profile)).toEqual({
      iccProfile: 'Display P3',
      colorSpace: 'Display P3',
    });
  });

  it('should report nothing for unrecognisable profile data', () => {
    expect(identifyIccProfile(Buffer.alloc(300, 0xab))).toEqual({});
  });
});
