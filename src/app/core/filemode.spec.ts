import { describe, expect, it } from 'vitest';

import { DEFAULT_FILE_MODE, formatFileMode, parseFileMode } from './filemode';

describe('formatFileMode', () => {
  it('renders stored bits as padded octal', () => {
    expect(formatFileMode(DEFAULT_FILE_MODE)).toBe('0444');
    expect(formatFileMode(0o400)).toBe('0400');
    expect(formatFileMode(0o7)).toBe('0007');
  });

  it('renders an unchosen mode as an empty field', () => {
    expect(formatFileMode(0)).toBe('');
    expect(formatFileMode(undefined)).toBe('');
  });
});

describe('parseFileMode', () => {
  it('reads the notations a user may type', () => {
    expect(parseFileMode('444')).toBe(0o444);
    expect(parseFileMode('0444')).toBe(0o444);
    expect(parseFileMode('0o444')).toBe(0o444);
    expect(parseFileMode('  440  ')).toBe(0o440);
  });

  it('reads an empty field as "not chosen"', () => {
    expect(parseFileMode('')).toBe(0);
    expect(parseFileMode('   ')).toBe(0);
  });

  it('rejects what the server would refuse', () => {
    expect(parseFileMode('888')).toBeUndefined(); // not octal digits
    expect(parseFileMode('4755')).toBeUndefined(); // setuid, beyond permission bits
    expect(parseFileMode('r--r--r--')).toBeUndefined();
  });

  it('round-trips through the display format', () => {
    expect(parseFileMode(formatFileMode(0o640))).toBe(0o640);
  });
});
