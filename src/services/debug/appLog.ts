export type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'event';

export interface LogEntry {
  id: number;
  ts: number;            // Date.now()
  level: LogLevel;
  channel?: string;      // for level='event' or arbitrary tagging
  text: string;
}

const MAX_ENTRIES = 500;

let buffer: LogEntry[] = [];
let nextId = 1;
const listeners = new Set<(entries: LogEntry[]) => void>();
let initialized = false;

function notify(): void {
  // Use slice() so subscribers get a stable reference snapshot.
  const snapshot = buffer.slice();
  for (const fn of listeners) {
    try { fn(snapshot); }
    catch (err) {
      // Swallow listener errors so one broken consumer can't kill the feed.
      // Use original console (post-init we'd recurse if patched).
      originalConsole.error?.('[appLog] listener threw:', err);
    }
  }
}

function stringifyArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) {
    const stack = (arg.stack ?? '').split('\n').slice(0, 4).join('\n');
    return `${arg.name}: ${arg.message}\n${stack}`;
  }
  if (arg === undefined) return 'undefined';
  if (arg === null) return 'null';
  try { return JSON.stringify(arg); }
  catch { return '[unserializable]'; }
}

function formatArgs(args: unknown[]): string {
  return args.map(stringifyArg).join(' ');
}

// Hold references before patching, so internal logging never recurses.
const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

function push(level: LogLevel, channel: string | undefined, text: string): void {
  const entry: LogEntry = { id: nextId++, ts: Date.now(), level, channel, text };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.splice(0, buffer.length - MAX_ENTRIES);
  notify();
}

export const appLog = {
  init(): void {
    if (initialized) return;
    initialized = true;

    console.log = (...args: unknown[]) => {
      try { push('log', undefined, formatArgs(args)); } catch {}
      originalConsole.log(...args);
    };
    console.info = (...args: unknown[]) => {
      try { push('info', undefined, formatArgs(args)); } catch {}
      originalConsole.info(...args);
    };
    console.warn = (...args: unknown[]) => {
      try { push('warn', undefined, formatArgs(args)); } catch {}
      originalConsole.warn(...args);
    };
    console.error = (...args: unknown[]) => {
      try { push('error', undefined, formatArgs(args)); } catch {}
      originalConsole.error(...args);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('error', (e) => {
        try { push('error', 'window', `${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`); } catch {}
      });
      window.addEventListener('unhandledrejection', (e) => {
        try { push('error', 'promise', stringifyArg(e.reason)); } catch {}
      });
    }
  },

  emit(level: LogLevel, channel: string | undefined, ...args: unknown[]): void {
    push(level, channel, formatArgs(args));
  },

  subscribe(fn: (entries: LogEntry[]) => void): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },

  snapshot(): LogEntry[] {
    return buffer.slice();
  },

  clear(): void {
    buffer = [];
    notify();
  },
};
