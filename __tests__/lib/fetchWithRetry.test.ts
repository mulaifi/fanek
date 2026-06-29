import { fetchWithRetry } from '@/lib/fetchWithRetry';

// A no-op sleep that records the requested delays so the backoff schedule can be
// asserted without real timers. Honors abort to mirror the real implementation.
function makeRecordingSleep() {
  const delays: number[] = [];
  const sleep = (ms: number, signal?: AbortSignal | null) => {
    delays.push(ms);
    if (signal?.aborted) {
      return Promise.reject(
        signal.reason ?? new DOMException('Aborted', 'AbortError'),
      );
    }
    return Promise.resolve();
  };
  return { delays, sleep };
}

const res = (status: number) => new Response(status === 204 ? null : 'body', { status });

describe('fetchWithRetry', () => {
  test('returns the response on first success without retrying', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(res(200));
    const { sleep, delays } = makeRecordingSleep();

    const out = await fetchWithRetry('/api/x', undefined, { fetchImpl, sleep });

    expect(out.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(delays).toHaveLength(0);
  });

  test('retries network errors and succeeds within the cap', async () => {
    const fetchImpl = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(res(200));
    const { sleep } = makeRecordingSleep();

    const out = await fetchWithRetry('/api/x', undefined, { retries: 2, fetchImpl, sleep });

    expect(out.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  test('gives up after the retry cap and rethrows the last network error', async () => {
    const err = new TypeError('Failed to fetch');
    const fetchImpl = jest.fn().mockRejectedValue(err);
    const { sleep } = makeRecordingSleep();

    await expect(
      fetchWithRetry('/api/x', undefined, { retries: 2, fetchImpl, sleep }),
    ).rejects.toBe(err);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  test('retries 5xx responses then returns the eventual success', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(res(503))
      .mockResolvedValueOnce(res(200));
    const { sleep } = makeRecordingSleep();

    const out = await fetchWithRetry('/api/x', undefined, { retries: 2, fetchImpl, sleep });

    expect(out.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('returns the last 5xx response (does not throw) after exhausting retries', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(res(500));
    const { sleep } = makeRecordingSleep();

    const out = await fetchWithRetry('/api/x', undefined, { retries: 2, fetchImpl, sleep });

    expect(out.status).toBe(500);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  test('does not retry a non-retryable 4xx response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(res(404));
    const { sleep, delays } = makeRecordingSleep();

    const out = await fetchWithRetry('/api/x', undefined, { retries: 2, fetchImpl, sleep });

    expect(out.status).toBe(404);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(delays).toHaveLength(0);
  });

  test('does not retry non-idempotent methods (POST) on failure', async () => {
    const err = new TypeError('Failed to fetch');
    const fetchImpl = jest.fn().mockRejectedValue(err);
    const { sleep } = makeRecordingSleep();

    await expect(
      fetchWithRetry('/api/x', { method: 'POST' }, { retries: 2, fetchImpl, sleep }),
    ).rejects.toBe(err);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('uses exponential backoff (jitter off) for the delay schedule', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(res(503));
    const { sleep, delays } = makeRecordingSleep();

    await fetchWithRetry('/api/x', undefined, {
      retries: 3,
      backoffMs: 100,
      jitter: false,
      fetchImpl,
      sleep,
    });

    expect(delays).toEqual([100, 200, 400]);
  });

  test('caps the backoff at maxBackoffMs', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(res(503));
    const { sleep, delays } = makeRecordingSleep();

    await fetchWithRetry('/api/x', undefined, {
      retries: 4,
      backoffMs: 100,
      maxBackoffMs: 250,
      jitter: false,
      fetchImpl,
      sleep,
    });

    expect(delays).toEqual([100, 200, 250, 250]);
  });

  test('throws immediately without fetching when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = jest.fn().mockResolvedValue(res(200));
    const { sleep } = makeRecordingSleep();

    await expect(
      fetchWithRetry('/api/x', { signal: controller.signal }, { fetchImpl, sleep }),
    ).rejects.toBeDefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('stops retrying when aborted during the backoff window', async () => {
    const controller = new AbortController();
    const fetchImpl = jest.fn().mockResolvedValue(res(503));
    // Abort the moment the first backoff sleep is requested.
    const sleep = (_ms: number, signal?: AbortSignal | null) => {
      controller.abort();
      return Promise.reject(
        signal?.reason ?? new DOMException('Aborted', 'AbortError'),
      );
    };

    await expect(
      fetchWithRetry('/api/x', { signal: controller.signal }, { retries: 3, fetchImpl, sleep }),
    ).rejects.toBeDefined();
    expect(fetchImpl).toHaveBeenCalledTimes(1); // first attempt only, no retry
  });

  test('does not retry an AbortError thrown by the underlying fetch', async () => {
    const abortErr = new DOMException('Aborted', 'AbortError');
    const fetchImpl = jest.fn().mockRejectedValue(abortErr);
    const { sleep } = makeRecordingSleep();

    await expect(
      fetchWithRetry('/api/x', undefined, { retries: 2, fetchImpl, sleep }),
    ).rejects.toBe(abortErr);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('invokes onRetry with attempt metadata before each retry', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(res(503))
      .mockResolvedValueOnce(res(200));
    const onRetry = jest.fn();
    const { sleep } = makeRecordingSleep();

    await fetchWithRetry('/api/x', undefined, {
      retries: 2,
      jitter: false,
      backoffMs: 100,
      fetchImpl,
      sleep,
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 1, delayMs: 100 }),
    );
  });
});
