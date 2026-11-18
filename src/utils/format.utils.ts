import {
  BYTES_PER_MEGABYTE,
  DISPLAY_DECIMAL_PLACES,
} from '../constants/measurement.constants.js';

function formatMegabytes(bytes: number): string {
  return (bytes / BYTES_PER_MEGABYTE).toFixed(DISPLAY_DECIMAL_PLACES);
}

export function formatDuration(durationMs: number): string {
  return `${durationMs.toFixed(DISPLAY_DECIMAL_PLACES)} ms`;
}

export function formatSize(bytes: number): string {
  return `${formatMegabytes(bytes)} MB`;
}

export function formatSpeed(bytesPerSecond: number): string {
  return `${formatMegabytes(bytesPerSecond)} MB/s`;
}
