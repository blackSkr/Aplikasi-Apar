// src/setupNetworking.ts
import { createLogger } from './utils/Logger';
const netlog = createLogger('net');

// Pasang sekali saja
export function installFetchLogger() {
  const g: any = globalThis as any;
  if (g.__fetchLoggerInstalled) return;
  g.__fetchLoggerInstalled = true;

  const orig = global.fetch;
  global.fetch = async (input: any, init?: RequestInit) => {
    const method = (init?.method || 'GET').toUpperCase();
    const url = typeof input === 'string' ? input : String(input?.url || input);
    const t0 = Date.now();
    try {
      const res = await orig(input, init);
      const dt = Date.now() - t0;
      netlog.info(`${method} ${url} → ${res.status} (${dt}ms)`);
      return res;
    } catch (e: any) {
      const dt = Date.now() - t0;
      netlog.error(`${method} ${url} ✖ ${e?.message || e} (${dt}ms)`);
      throw e;
    }
  };
}
