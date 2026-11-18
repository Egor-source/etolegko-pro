import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  formatSize,
  formatSpeed,
} from '../src/utils/format.utils.js';

describe('output formatting', () => {
  it('rounds duration to two decimal places in milliseconds', () => {
    expect(formatDuration(235.426)).toBe('235.43 ms');
    expect(formatDuration(0)).toBe('0.00 ms');
  });

  it('converts bytes to decimal megabytes', () => {
    expect(formatSize(1_000_000)).toBe('1.00 MB');
    expect(formatSize(2_506_000)).toBe('2.51 MB');
    expect(formatSize(0)).toBe('0.00 MB');
  });

  it('converts bytes per second to decimal megabytes per second', () => {
    expect(formatSpeed(11_083_000)).toBe('11.08 MB/s');
    expect(formatSpeed(0)).toBe('0.00 MB/s');
  });
});
