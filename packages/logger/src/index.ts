export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  level?: LogLevel;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

// `console.error(prefix, message, { error })` renders an `Error` as `{}` in Workers Logs (only
// own enumerable properties survive), which is exactly the detail we need most. Unwrap any
// `Error` values in `meta` (including nested `cause` chains) into plain `{ name, message, stack }`
// so the interesting fields actually show up.
function serializeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      ...(value.cause !== undefined ? { cause: serializeValue(value.cause) } : {}),
    };
  }
  return value;
}

function serializeMeta(meta: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(meta).map(([key, value]) => [key, serializeValue(value)]));
}

export function createLogger(namespace: string, opts?: LoggerOptions): Logger {
  const minLevel = opts?.level ?? 'debug';
  const minIndex = LEVELS.indexOf(minLevel);

  const log = (level: LogLevel, message: string, meta?: Record<string, unknown>): void => {
    if (LEVELS.indexOf(level) < minIndex) {
      return;
    }
    const prefix = `[${namespace}]`;
    if (meta !== undefined) {
      console[level](prefix, message, serializeMeta(meta));
    } else {
      console[level](prefix, message);
    }
  };

  return {
    debug: (message, meta) => log('debug', message, meta),
    info: (message, meta) => log('info', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    error: (message, meta) => log('error', message, meta),
  };
}
