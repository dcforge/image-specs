/**
 * BufferReader for efficient buffer reading operations
 */
export class BufferReader {
  private readonly buffer: Buffer;
  private position = 0;
  private readonly littleEndian = false;

  constructor(buffer: Buffer, littleEndian = false) {
    this.buffer = buffer;
    this.littleEndian = littleEndian;
  }

  /**
   * Read unsigned 8-bit integer
   */
  readUInt8(): number {
    if (this.position >= this.buffer.length) {
      throw new Error('Attempt to read past buffer');
    }
    const value = this.buffer[this.position];
    this.position++;
    return value ?? 0;
  }

  /**
   * Read unsigned 16-bit integer
   */
  readUInt16(): number {
    if (this.position + 2 > this.buffer.length) {
      throw new Error('Attempt to read past buffer');
    }
    const value = this.littleEndian
      ? this.buffer.readUInt16LE(this.position)
      : this.buffer.readUInt16BE(this.position);
    this.position += 2;
    return value;
  }

  /**
   * Read unsigned 32-bit integer
   */
  readUInt32(): number {
    if (this.position + 4 > this.buffer.length) {
      throw new Error('Attempt to read past buffer');
    }
    const value = this.littleEndian
      ? this.buffer.readUInt32LE(this.position)
      : this.buffer.readUInt32BE(this.position);
    this.position += 4;
    return value;
  }

  /**
   * Read signed 32-bit integer
   */
  readInt32(): number {
    if (this.position + 4 > this.buffer.length) {
      throw new Error('Attempt to read past buffer');
    }
    const value = this.littleEndian
      ? this.buffer.readInt32LE(this.position)
      : this.buffer.readInt32BE(this.position);
    this.position += 4;
    return value;
  }

  /**
   * Read string
   */
  readString(length: number, encoding: BufferEncoding = 'utf8'): string {
    if (this.position + length > this.buffer.length) {
      throw new Error('Attempt to read past buffer');
    }
    const str = this.buffer.toString(encoding, this.position, this.position + length);
    this.position += length;
    return str;
  }

  /**
   * Read null-terminated string
   */
  readNullTerminatedString(maxLength?: number, encoding: BufferEncoding = 'utf8'): string {
    const start = this.position;
    const max = maxLength ? Math.min(this.position + maxLength, this.buffer.length) : this.buffer.length;

    let end = start;
    while (end < max && this.buffer[end] !== 0) {
      end++;
    }

    const str = this.buffer.toString(encoding, start, end);
    this.position = end < max ? end + 1 : end; // Skip null terminator if found
    return str;
  }

  /**
   * Read bytes as Buffer
   */
  readBytes(length: number): Buffer {
    if (this.position + length > this.buffer.length) {
      throw new Error('Attempt to read past buffer');
    }
    const bytes = this.buffer.subarray(this.position, this.position + length);
    this.position += length;
    return bytes;
  }

  /**
   * Skip bytes
   */
  skip(bytes: number): void {
    this.position = Math.min(this.position + bytes, this.buffer.length);
  }

  /**
   * Seek to position
   */
  seek(position: number): void {
    if (position < 0 || position > this.buffer.length) {
      throw new Error('Invalid seek position');
    }
    this.position = position;
  }

  /**
   * Get current position
   */
  getPosition(): number {
    return this.position;
  }

  /**
   * Get remaining bytes
   */
  remaining(): number {
    return this.buffer.length - this.position;
  }

  /**
   * Check if can read bytes
   */
  canRead(bytes: number): boolean {
    return this.position + bytes <= this.buffer.length;
  }

  /**
   * Get underlying buffer
   */
  getBuffer(): Buffer {
    return this.buffer;
  }

  /**
   * Peek unsigned 8-bit integer without advancing
   */
  peekUInt8(): number {
    if (this.position >= this.buffer.length) {
      throw new Error('Attempt to peek past buffer');
    }
    return this.buffer[this.position] ?? 0;
  }
}