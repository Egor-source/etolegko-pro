export type BenchmarkDependencies = {
  fetch?: typeof fetch;
  now?: () => number;
};

export type RequestMeasurement = {
  requestNumber: number;
  durationMs: number;
  bytes: number;
};

export type BenchmarkResult = {
  measurements: readonly RequestMeasurement[];
  averageDurationMs: number;
  totalBytes: number;
  totalDurationMs: number;
  bytesPerSecond: number;
};
