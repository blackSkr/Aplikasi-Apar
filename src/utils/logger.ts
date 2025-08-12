// src/utils/logger.ts
type Level = 'debug' | 'info' | 'warn' | 'error';
const ENABLED = true;

export function createLogger(ns: string) {
  const tag = `[${ns}]`;
  const out = (lvl: Level, ...args: any[]) => {
    if (!ENABLED) return;
    (console as any)[lvl === 'debug' ? 'log' : lvl](tag, ...args);
  };
  return {
    debug: (...a: any[]) => out('debug', ...a),
    info:  (...a: any[]) => out('info',  ...a),
    warn:  (...a: any[]) => out('warn',  ...a),
    error: (...a: any[]) => out('error', ...a),
  };
}
