import {
  REQUEST_COUNT,
  REQUEST_TIMEOUT_MS,
} from '../constants/benchmark.constants.js';
import { MILLISECONDS_PER_SECOND } from '../constants/measurement.constants.js';
import type {
  BenchmarkDependencies,
  BenchmarkResult,
  RequestMeasurement,
} from '../types/benchmark.types.js';

function describeTransferError(error: unknown): string {
  if (error instanceof Error) {
    return error.cause instanceof Error
      ? `${error.message}: ${error.cause.message}`
      : error.message;
  }

  return String(error);
}

async function measureDownload(
  url: URL,
  requestNumber: number,
  fetchResource: typeof fetch,
  now: () => number,
): Promise<RequestMeasurement> {
  const request = `Request ${requestNumber}/${REQUEST_COUNT}`;
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const startedAt = now();
  let failureMessage = 'network request failed';
  let bytes = 0;

  try {
    const response = await fetchResource(url, {
      method: 'GET',
      redirect: 'manual',
      signal,
    });

    if (!response.ok) {
      failureMessage = `HTTP ${response.status}`;
      await response.body?.cancel();
      throw new Error(response.statusText || 'unexpected status');
    }

    failureMessage = 'could not read the response body';
    if (response.body) {
      for await (const chunk of response.body) {
        bytes += chunk.byteLength;
      }
    }
  } catch (error) {
    const message = signal.aborted
      ? `timed out after ${REQUEST_TIMEOUT_MS} ms`
      : `${failureMessage} (${describeTransferError(error)})`;
    throw new Error(`${request}: ${message}`, { cause: error });
  }

  return { requestNumber, durationMs: now() - startedAt, bytes };
}

export async function runBenchmark(
  url: URL,
  {
    fetch: fetchResource = fetch,
    now = () => performance.now(),
  }: BenchmarkDependencies = {},
): Promise<BenchmarkResult> {
  const measurements: RequestMeasurement[] = [];
  let totalBytes = 0;
  let totalDurationMs = 0;

  for (let requestNumber = 1; requestNumber <= REQUEST_COUNT; requestNumber++) {
    const measurement = await measureDownload(
      url,
      requestNumber,
      fetchResource,
      now,
    );
    measurements.push(measurement);
    totalBytes += measurement.bytes;
    totalDurationMs += measurement.durationMs;
  }

  const bytesPerSecond =
    totalDurationMs === 0
      ? 0
      : totalBytes / (totalDurationMs / MILLISECONDS_PER_SECOND);

  return {
    measurements,
    averageDurationMs: totalDurationMs / REQUEST_COUNT,
    totalBytes,
    totalDurationMs,
    bytesPerSecond,
  };
}
