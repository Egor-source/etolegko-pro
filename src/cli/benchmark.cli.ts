import { Command, CommanderError } from 'commander';
import { REQUEST_COUNT, runBenchmark } from '../services/benchmark.service.js';
import type { BenchmarkResult } from '../types/benchmark.types.js';
import {
  formatDuration,
  formatSize,
  formatSpeed,
} from '../utils/format.utils.js';

type CliOutput = {
  writeOut: (text: string) => void;
  writeErr: (text: string) => void;
};

function parseHttpUrl(value: string): URL {
  const url = URL.parse(value);
  if (!url) {
    throw new Error('Invalid URL. Provide an absolute HTTP or HTTPS URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(
      `Unsupported protocol (${url.protocol}). Use HTTP or HTTPS.`,
    );
  }
  if (url.username || url.password) {
    throw new Error('Credentials embedded in the URL are unsupported.');
  }
  return url;
}

function formatBenchmark(url: URL, result: BenchmarkResult): string {
  const {
    measurements,
    averageDurationMs,
    totalBytes,
    totalDurationMs,
    bytesPerSecond,
  } = result;
  const requestLines = measurements.map(
    ({ requestNumber, durationMs, bytes }) => {
      return `Request ${requestNumber}/${REQUEST_COUNT}: ${formatDuration(durationMs)} | ${formatSize(bytes)}`;
    },
  );

  return [
    'Download benchmark',
    `URL: ${url.href}`,
    '',
    ...requestLines,
    '',
    'Results:',
    `Requests:       ${measurements.length}`,
    `Average time:   ${formatDuration(averageDurationMs)}`,
    `Total size:     ${formatSize(totalBytes)}`,
    `Total duration: ${formatDuration(totalDurationMs)}`,
    `Download speed: ${formatSpeed(bytesPerSecond)}`,
    '',
  ].join('\n');
}

export async function runCli(
  args: readonly string[],
  output: CliOutput = {
    writeOut: (text) => process.stdout.write(text),
    writeErr: (text) => process.stderr.write(text),
  },
): Promise<number> {
  const program = new Command()
    .name('download-benchmark')
    .description(
      `Measure download speed with ${REQUEST_COUNT} sequential HTTP GET requests.`,
    )
    .argument('<url>', 'absolute HTTP or HTTPS URL')
    .configureOutput(output)
    .showHelpAfterError()
    .exitOverride()
    .action(async (value: string) => {
      const url = parseHttpUrl(value);
      const result = await runBenchmark(url);
      output.writeOut(formatBenchmark(url, result));
    });

  try {
    await program.parseAsync(args, { from: 'user' });
    return 0;
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode === 0 ? 0 : 1;
    }

    const message = error instanceof Error ? error.message : String(error);
    output.writeErr(`Error: ${message}\n`);
    return 1;
  }
}
