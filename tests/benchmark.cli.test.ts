import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runCli } from '../src/cli/benchmark.cli.js';
import { runBenchmark } from '../src/services/benchmark.service.js';

vi.mock(
  import('../src/services/benchmark.service.js'),
  async (importOriginal) => ({
    ...(await importOriginal()),
    runBenchmark: vi.fn(),
  }),
);

const output = {
  writeOut: vi.fn<(text: string) => void>(),
  writeErr: vi.fn<(text: string) => void>(),
};
const benchmark = vi.mocked(runBenchmark);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('runCli', () => {
  it('shows generated help and exits successfully', async () => {
    await expect(runCli(['--help'], output)).resolves.toBe(0);

    expect(output.writeOut).toHaveBeenCalledWith(
      expect.stringContaining('Usage: download-benchmark'),
    );
    expect(output.writeOut).toHaveBeenCalledWith(
      expect.stringContaining('<url>'),
    );
    expect(output.writeErr).not.toHaveBeenCalled();
    expect(benchmark).not.toHaveBeenCalled();
  });

  it('reports the missing URL and shows usage', async () => {
    await expect(runCli([], output)).resolves.toBe(1);

    expect(output.writeErr).toHaveBeenCalledWith(
      expect.stringContaining("missing required argument 'url'"),
    );
    expect(output.writeErr).toHaveBeenCalledWith(
      expect.stringContaining('Usage: download-benchmark'),
    );
    expect(output.writeOut).not.toHaveBeenCalled();
    expect(benchmark).not.toHaveBeenCalled();
  });

  it.each([
    ['/relative/path', 'Invalid URL'],
    ['ftp://example.test/file', 'Unsupported protocol'],
    [
      'https://user:password@example.test/file',
      'Credentials embedded in the URL are unsupported',
    ],
  ])('rejects %s before running the benchmark', async (target, message) => {
    await expect(runCli([target], output)).resolves.toBe(1);

    expect(output.writeErr).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining(message),
    );
    expect(output.writeOut).not.toHaveBeenCalled();
    expect(benchmark).not.toHaveBeenCalled();
  });

  it('preserves query parameters and prints the measurements and summary', async () => {
    const target = 'https://example.test/image.jpg?size=large&v=2';
    benchmark.mockResolvedValue({
      measurements: Array.from({ length: 10 }, (_, index) => ({
        requestNumber: index + 1,
        durationMs: 250,
        bytes: 2_500_000,
      })),
      averageDurationMs: 250,
      totalBytes: 25_000_000,
      totalDurationMs: 2_500,
      bytesPerSecond: 10_000_000,
    });

    await expect(runCli([target], output)).resolves.toBe(0);

    expect(benchmark).toHaveBeenCalledExactlyOnceWith(new URL(target));
    const text = output.writeOut.mock.calls[0]?.[0];
    expect(text).toContain(`URL: ${target}`);
    expect(
      text?.match(/^Request \d+\/10: 250\.00 ms \| 2\.50 MB$/gm),
    ).toHaveLength(10);
    expect(text).toContain('Requests:       10');
    expect(text).toContain('Average time:   250.00 ms');
    expect(text).toContain('Total size:     25.00 MB');
    expect(text).toContain('Total duration: 2500.00 ms');
    expect(text).toContain('Download speed: 10.00 MB/s');
    expect(output.writeErr).not.toHaveBeenCalled();
  });

  it('reports a failed benchmark without printing results', async () => {
    benchmark.mockRejectedValue(
      new Error('Request 3/10: HTTP 404 (Not Found)'),
    );

    await expect(runCli(['http://example.test/'], output)).resolves.toBe(1);

    expect(output.writeErr).toHaveBeenCalledExactlyOnceWith(
      'Error: Request 3/10: HTTP 404 (Not Found)\n',
    );
    expect(output.writeOut).not.toHaveBeenCalled();
  });
});
