import { afterEach, describe, expect, it, vi } from 'vitest';
import { runBenchmark } from '../src/services/benchmark.service.js';

const url = new URL('https://example.test/file?size=500');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runBenchmark', () => {
  it('makes ten GET requests and calculates metrics from actual chunks and elapsed time', async () => {
    let time = 0;
    let requestNumber = 0;
    const client = vi.fn<typeof fetch>(async () => {
      const isOdd = ++requestNumber % 2 === 1;
      time += 25;
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          time += isOdd ? 75 : 275;
          controller.enqueue(new Uint8Array(20));
          controller.enqueue(new Uint8Array(isOdd ? 80 : 480));
          controller.close();
        },
      });
      return new Response(body, { headers: { 'content-length': '9999' } });
    });

    const result = await runBenchmark(url, { fetch: client, now: () => time });

    expect(client).toHaveBeenCalledTimes(10);
    for (const [target, options] of client.mock.calls) {
      expect(target).toBe(url);
      expect(options).toEqual({
        method: 'GET',
        redirect: 'manual',
        signal: expect.any(AbortSignal),
      });
    }
    expect(
      new Set(client.mock.calls.map(([, options]) => options?.signal)).size,
    ).toBe(10);
    expect(result).toEqual({
      measurements: Array.from({ length: 10 }, (_, index) => ({
        requestNumber: index + 1,
        durationMs: index % 2 === 0 ? 100 : 300,
        bytes: index % 2 === 0 ? 100 : 500,
      })),
      averageDurationMs: 200,
      totalBytes: 3_000,
      totalDurationMs: 2_000,
      bytesPerSecond: 1_500,
    });
  });

  it('waits for the end of each response before starting another request', async () => {
    const transfers = Array.from({ length: 10 }, () => {
      const firstRead =
        Promise.withResolvers<ReadableStreamDefaultController<Uint8Array>>();
      const lastRead = Promise.withResolvers<void>();
      let readingStarted = false;
      const body = new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            if (readingStarted) {
              lastRead.resolve();
            } else {
              readingStarted = true;
              firstRead.resolve(controller);
            }
          },
        },
        { highWaterMark: 0 },
      );
      return { firstRead, lastRead, response: new Response(body) };
    });
    const client = vi.fn<typeof fetch>();
    for (const { response } of transfers) {
      client.mockResolvedValueOnce(response);
    }

    const result = runBenchmark(url, { fetch: client });

    for (const [index, { firstRead, lastRead }] of transfers.entries()) {
      const controller = await firstRead.promise;
      expect(client).toHaveBeenCalledTimes(index + 1);
      controller.enqueue(new Uint8Array(1));
      await lastRead.promise;
      expect(client).toHaveBeenCalledTimes(index + 1);
      controller.close();
    }
    await expect(result).resolves.toMatchObject({ totalBytes: 10 });
  });

  it('returns zero bytes and speed for empty successful responses', async () => {
    const client = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 204 }),
    );
    let time = 0;

    await expect(
      runBenchmark(url, { fetch: client, now: () => time++ }),
    ).resolves.toMatchObject({
      averageDurationMs: 1,
      totalDurationMs: 10,
      totalBytes: 0,
      bytesPerSecond: 0,
    });
  });

  it('returns zero speed when the measured duration is zero', async () => {
    const client = vi.fn<typeof fetch>(async () => new Response('data'));

    await expect(
      runBenchmark(url, { fetch: client, now: () => 0 }),
    ).resolves.toMatchObject({
      averageDurationMs: 0,
      totalDurationMs: 0,
      totalBytes: 40,
      bytesPerSecond: 0,
    });
  });

  it.each([302, 404, 503])(
    'cancels the response body and stops on HTTP %i',
    async (status) => {
      const cancel = vi.fn();
      const body = new ReadableStream<Uint8Array>({ cancel });
      const client = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(new Response('ok'))
        .mockResolvedValueOnce(new Response(body, { status }));

      await expect(runBenchmark(url, { fetch: client })).rejects.toThrow(
        `Request 2/10: HTTP ${status}`,
      );
      expect(cancel).toHaveBeenCalledOnce();
      expect(client).toHaveBeenCalledTimes(2);
    },
  );

  it.each(['getaddrinfo ENOTFOUND example.test', 'connect ECONNREFUSED'])(
    'stops on a network error and includes its cause (%s)',
    async (message) => {
      const client = vi
        .fn<typeof fetch>()
        .mockRejectedValue(
          new TypeError('fetch failed', { cause: new Error(message) }),
        );

      await expect(runBenchmark(url, { fetch: client })).rejects.toThrow(
        `Request 1/10: network request failed (fetch failed: ${message})`,
      );
      expect(client).toHaveBeenCalledOnce();
    },
  );

  it('stops and releases the reader when the connection breaks during the download', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(4));
      },
      pull() {
        throw new TypeError('terminated');
      },
    });
    const client = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));

    await expect(runBenchmark(url, { fetch: client })).rejects.toThrow(
      'Request 1/10: could not read the response body (terminated)',
    );
    expect(body.locked).toBe(false);
    expect(client).toHaveBeenCalledOnce();
  });

  it('stops when the request times out while reading the body', async () => {
    const timeout = new AbortController();
    const createTimeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(timeout.signal);
    const startedReading = Promise.withResolvers<void>();
    const client = vi.fn<typeof fetch>(async (_target, options) => {
      const signal = options?.signal;
      const body = new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            signal?.addEventListener(
              'abort',
              () => controller.error(signal.reason),
              { once: true },
            );
            startedReading.resolve();
          },
        },
        { highWaterMark: 0 },
      );
      return new Response(body);
    });

    const assertion = expect(
      runBenchmark(url, { fetch: client }),
    ).rejects.toThrow('Request 1/10: timed out after 30000 ms');
    await startedReading.promise;
    timeout.abort(new DOMException('The operation timed out.', 'TimeoutError'));

    await assertion;
    expect(createTimeout).toHaveBeenCalledExactlyOnceWith(30_000);
    expect(client).toHaveBeenCalledOnce();
  });
});
