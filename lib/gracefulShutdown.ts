/**
 * Graceful shutdown wiring (see issue #73).
 *
 * On `SIGTERM` / `SIGINT` (e.g. `docker stop`, Ctrl-C, an orchestrator rolling
 * the container) we want in-flight Prisma queries to finish and the connection
 * pool to close cleanly before the process exits — otherwise Postgres is left to
 * reap half-open connections and clients can see truncated responses.
 *
 * This module is deliberately dependency-injected and side-effect-free on import
 * so it can be unit-tested without spawning real signal handlers. The actual
 * registration happens from `instrumentation.ts`'s `register()` hook, which only
 * runs in the Node.js server runtime.
 */

type ShutdownLogger = {
  info: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
};

export interface RegisterGracefulShutdownDeps {
  /** Close the DB pool (typically `() => prisma.$disconnect()`). */
  disconnect: () => Promise<void>;
  /** Optional structured logger. */
  logger?: ShutdownLogger;
  /** Signals to listen for. Default SIGTERM + SIGINT. */
  signals?: NodeJS.Signals[];
  /** Process to attach to (injectable for tests). Default `process`. */
  process?: Pick<NodeJS.Process, 'on' | 'off' | 'exit'>;
  /** Exit function (injectable for tests). Default `process.exit`. */
  exit?: (code: number) => void;
}

// Module-level guard so a dev hot-reload (or an accidental second call) does not
// stack duplicate handlers on the same process.
let registered = false;

/**
 * Register graceful-shutdown signal handlers.
 *
 * Idempotent: calling it again while already registered is a no-op. Returns an
 * `unregister()` function that detaches the handlers and resets the guard
 * (primarily for tests / hot-reload teardown).
 */
export function registerGracefulShutdown(deps: RegisterGracefulShutdownDeps): () => void {
  const proc = deps.process ?? process;
  const exit = deps.exit ?? ((code: number) => process.exit(code));
  const signals = deps.signals ?? (['SIGTERM', 'SIGINT'] as NodeJS.Signals[]);
  const logger = deps.logger;

  if (registered) return () => {};
  registered = true;

  let shuttingDown = false;

  const makeHandler = (signal: NodeJS.Signals) => {
    const handler = async () => {
      if (shuttingDown) return; // a second signal during teardown is ignored
      shuttingDown = true;
      logger?.info({ signal }, 'Received shutdown signal, disconnecting Prisma');
      try {
        await deps.disconnect();
        logger?.info({ signal }, 'Prisma disconnected, exiting cleanly');
        exit(0);
      } catch (err) {
        logger?.error({ signal, err }, 'Error during graceful shutdown');
        exit(1);
      }
    };
    return handler;
  };

  const entries = signals.map((signal) => {
    const handler = makeHandler(signal);
    proc.on(signal, handler);
    return { signal, handler };
  });

  return () => {
    for (const { signal, handler } of entries) {
      proc.off(signal, handler);
    }
    registered = false;
  };
}

/** Test-only: reset the module guard without needing the unregister handle. */
export function __resetGracefulShutdownForTests(): void {
  registered = false;
}
