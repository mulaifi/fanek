/**
 * fetchWithRetry — a thin, typed wrapper around `fetch` that transparently
 * retries *transient* failures (network errors and 5xx responses) with
 * exponential backoff.
 *
 * Design constraints (see issue #73):
 *  - Only idempotent methods (GET/HEAD/OPTIONS by default) are retried. A
 *    POST/PUT/DELETE/PATCH is issued exactly once so we never double-submit.
 *  - A caller-provided `AbortSignal` (via `init.signal`) is honored: an already
 *    aborted request never fires, and an abort during the backoff window stops
 *    the retry loop immediately.
 *  - On success the behavior is identical to a plain `fetch` — the resolved
 *    `Response` is returned untouched. A non-retryable error response (e.g. 404)
 *    is returned as-is, not thrown.
 *  - The number of retries is capped; once exhausted the last error is rethrown
 *    (network failure) or the last response is returned (5xx).
 *
 * The `sleep`, `random` and `fetchImpl` options exist as test seams so the
 * backoff schedule can be asserted deterministically without real timers.
 */

const DEFAULT_RETRY_METHODS = ['GET', 'HEAD', 'OPTIONS'];

export interface FetchWithRetryOptions {
  /** Maximum number of *retries* after the initial attempt. Default 2. */
  retries?: number;
  /** Base backoff delay in ms (the first retry waits ~this long). Default 200. */
  backoffMs?: number;
  /** Upper bound for a single backoff delay in ms. Default 2000. */
  maxBackoffMs?: number;
  /** Add "equal jitter" to each delay to avoid thundering herds. Default true. */
  jitter?: boolean;
  /** HTTP methods eligible for retry. Default GET/HEAD/OPTIONS (idempotent). */
  retryOnMethods?: string[];
  /** Decide whether a response status should be retried. Default `>= 500`. */
  isRetryableStatus?: (status: number) => boolean;
  /** Invoked before each scheduled retry — useful for logging/metrics. */
  onRetry?: (info: {
    attempt: number;
    delayMs: number;
    error?: unknown;
    response?: Response;
  }) => void;
  /** Test seam: abortable sleep. Default uses `setTimeout`. */
  sleep?: (ms: number, signal?: AbortSignal | null) => Promise<void>;
  /** Test seam: source of randomness for jitter. Default `Math.random`. */
  random?: () => number;
  /** Test seam: the underlying fetch implementation. Default global `fetch`. */
  fetchImpl?: typeof fetch;
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name?: unknown }).name === 'AbortError'
  );
}

function abortReason(signal: AbortSignal): unknown {
  // `reason` is the standard way to surface the cause; fall back for older envs.
  return signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
}

function defaultSleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(signal ? abortReason(signal) : new DOMException('Aborted', 'AbortError'));
    };
    function cleanup() {
      signal?.removeEventListener('abort', onAbort);
    }
    signal?.addEventListener('abort', onAbort);
  });
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const {
    retries = 2,
    backoffMs = 200,
    maxBackoffMs = 2000,
    jitter = true,
    retryOnMethods = DEFAULT_RETRY_METHODS,
    isRetryableStatus = (status: number) => status >= 500,
    onRetry,
    sleep = defaultSleep,
    random = Math.random,
    fetchImpl = fetch,
  } = options;

  const method = (init?.method ?? 'GET').toUpperCase();
  const methodIsRetryable = retryOnMethods.map((m) => m.toUpperCase()).includes(method);
  const maxAttempts = methodIsRetryable ? Math.max(0, retries) : 0;
  const signal = init?.signal ?? null;

  const computeDelay = (attempt: number): number => {
    const exp = Math.min(maxBackoffMs, backoffMs * 2 ** attempt);
    if (!jitter) return exp;
    // Equal jitter: keep half the delay, randomize the other half.
    return Math.round(exp / 2 + random() * (exp / 2));
  };

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (signal?.aborted) throw abortReason(signal);

    let response: Response | undefined;
    let caught: unknown;

    try {
      response = await fetchImpl(input, init);
    } catch (err) {
      // An aborted request must never be retried — surface it immediately.
      if (isAbortError(err) || signal?.aborted) throw err;
      caught = err;
    }

    if (response && !isRetryableStatus(response.status)) {
      return response;
    }

    const exhausted = attempt >= maxAttempts;
    if (exhausted) {
      if (response) return response; // last (retryable) response, e.g. a 503
      throw caught; // last network error
    }

    const delayMs = computeDelay(attempt);
    onRetry?.({ attempt: attempt + 1, delayMs, error: caught, response });
    await sleep(delayMs, signal);
    attempt += 1;
  }
}

export default fetchWithRetry;
