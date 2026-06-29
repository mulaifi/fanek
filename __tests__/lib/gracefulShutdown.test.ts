import { EventEmitter } from 'events';
import {
  registerGracefulShutdown,
  __resetGracefulShutdownForTests,
} from '@/lib/gracefulShutdown';

type FakeProc = Pick<NodeJS.Process, 'on' | 'off' | 'exit'> & EventEmitter;

function makeFakeProcess(): { proc: FakeProc; exit: jest.Mock } {
  const emitter = new EventEmitter() as FakeProc;
  const exit = jest.fn();
  // `exit` on the emitter is unused (we inject exit separately) but keep the type happy.
  (emitter as unknown as { exit: unknown }).exit = exit;
  return { proc: emitter, exit };
}

const flush = () => new Promise((r) => setImmediate(r));

describe('registerGracefulShutdown', () => {
  beforeEach(() => {
    __resetGracefulShutdownForTests();
  });

  test('disconnects and exits(0) on SIGTERM', async () => {
    const { proc, exit } = makeFakeProcess();
    const disconnect = jest.fn().mockResolvedValue(undefined);

    registerGracefulShutdown({ disconnect, process: proc, exit, signals: ['SIGTERM'] });

    proc.emit('SIGTERM');
    await flush();

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  test('registers all requested signals', () => {
    const { proc, exit } = makeFakeProcess();
    const disconnect = jest.fn().mockResolvedValue(undefined);

    registerGracefulShutdown({
      disconnect,
      process: proc,
      exit,
      signals: ['SIGTERM', 'SIGINT'],
    });

    expect(proc.listenerCount('SIGTERM')).toBe(1);
    expect(proc.listenerCount('SIGINT')).toBe(1);
  });

  test('exits(1) when disconnect rejects', async () => {
    const { proc, exit } = makeFakeProcess();
    const disconnect = jest.fn().mockRejectedValue(new Error('pool error'));
    const logger = { info: jest.fn(), error: jest.fn() };

    registerGracefulShutdown({ disconnect, process: proc, exit, logger, signals: ['SIGTERM'] });

    proc.emit('SIGTERM');
    await flush();

    expect(exit).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalled();
  });

  test('only disconnects once even if a second signal arrives', async () => {
    const { proc, exit } = makeFakeProcess();
    let resolveDisconnect: () => void = () => {};
    const disconnect = jest.fn(
      () => new Promise<void>((r) => (resolveDisconnect = r)),
    );

    registerGracefulShutdown({
      disconnect,
      process: proc,
      exit,
      signals: ['SIGTERM', 'SIGINT'],
    });

    proc.emit('SIGTERM');
    proc.emit('SIGINT'); // arrives mid-shutdown
    resolveDisconnect();
    await flush();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  test('is idempotent: a second register call attaches no extra handlers', () => {
    const { proc, exit } = makeFakeProcess();
    const disconnect = jest.fn().mockResolvedValue(undefined);

    registerGracefulShutdown({ disconnect, process: proc, exit, signals: ['SIGTERM'] });
    registerGracefulShutdown({ disconnect, process: proc, exit, signals: ['SIGTERM'] });

    expect(proc.listenerCount('SIGTERM')).toBe(1);
  });

  test('unregister detaches handlers and resets the guard', () => {
    const { proc, exit } = makeFakeProcess();
    const disconnect = jest.fn().mockResolvedValue(undefined);

    const unregister = registerGracefulShutdown({
      disconnect,
      process: proc,
      exit,
      signals: ['SIGTERM'],
    });
    expect(proc.listenerCount('SIGTERM')).toBe(1);

    unregister();
    expect(proc.listenerCount('SIGTERM')).toBe(0);

    // Guard reset → can register again.
    registerGracefulShutdown({ disconnect, process: proc, exit, signals: ['SIGTERM'] });
    expect(proc.listenerCount('SIGTERM')).toBe(1);
  });
});
