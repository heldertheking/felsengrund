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

export function createLogger(namespace: string, opts?: LoggerOptions): Logger {
  const minLevel = opts?.level ?? 'debug';
  const minIndex = LEVELS.indexOf(minLevel);

  const log = (level: LogLevel, message: string, meta?: Record<string, unknown>): void => {
    if (LEVELS.indexOf(level) < minIndex) {
      return;
    }
    const prefix = `[${namespace}]`;
    if (meta !== undefined) {
      console[level](prefix, message, meta);
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
