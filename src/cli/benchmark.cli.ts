import { Command, CommanderError } from 'commander';
import { REQUEST_COUNT } from '../constants/benchmark.constants.js';
import { runBenchmark } from '../services/benchmark.service.js';
import type { BenchmarkResult } from '../types/benchmark.types.js';
import type { CliOutput } from '../types/cli.types.js';
import {
  formatDuration,
  formatSize,
  formatSpeed,
} from '../utils/format.utils.js';
import { parseHttpUrl } from '../utils/url.utils.js';

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
