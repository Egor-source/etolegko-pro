const BYTES_PER_MEGABYTE = 1_000_000;

function formatMegabytes(bytes: number): string {
  return (bytes / BYTES_PER_MEGABYTE).toFixed(2);
}

export function formatDuration(durationMs: number): string {
  return `${durationMs.toFixed(2)} ms`;
}

export function formatSize(bytes: number): string {
  return `${formatMegabytes(bytes)} MB`;
}

export function formatSpeed(bytesPerSecond: number): string {
  return `${formatMegabytes(bytesPerSecond)} MB/s`;
}
