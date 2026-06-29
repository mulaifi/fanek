/**
 * Next.js instrumentation hook.
 *
 * `register()` runs once when the server process boots (stable in Next 16, no
 * experimental flag required). We use it to wire graceful-shutdown handlers so
 * SIGTERM/SIGINT (e.g. `docker stop`) cleanly disconnects Prisma's connection
 * pool — letting in-flight queries finish before the process exits.
 *
 * Guards:
 *  - `NEXT_RUNTIME === 'nodejs'` ensures this never runs in the Edge runtime,
 *    where `process` signals and the Prisma client are unavailable.
 *  - imports are dynamic so the Prisma client / pino are not pulled into bundles
 *    that don't need them.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const [{ default: prisma }, { default: logger }, { registerGracefulShutdown }] =
    await Promise.all([
      import('@/lib/prisma'),
      import('@/lib/logger'),
      import('@/lib/gracefulShutdown'),
    ]);

  registerGracefulShutdown({
    disconnect: () => prisma.$disconnect(),
    logger,
  });
}
