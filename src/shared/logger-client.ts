const isProd = process.env.NODE_ENV === 'production';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

async function sendToServer(level: LogLevel, message: string, meta?: unknown) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const payload = JSON.stringify({ level, message, meta, url: location.href, ts: Date.now() });
      navigator.sendBeacon('/api/client-logs', payload);
      return;
    }

    await fetch('/api/client-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, message, meta, url: (typeof location !== 'undefined' && location.href) || null, ts: Date.now() })
    });
  } catch {
    // swallow network errors to avoid impacting the app
  }
}

function formatArgs(args: unknown[]) {
  return args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
}

export const logger = {
  info: (...args: unknown[]) => {
    if (!isProd) {
      console.info(...args);
      return;
    }
    const msg = formatArgs(args);
    void sendToServer('info', msg);
  },
  warn: (...args: unknown[]) => {
    if (!isProd) {
      console.warn(...args);
      return;
    }
    const msg = formatArgs(args);
    void sendToServer('warn', msg);
  },
  error: (...args: unknown[]) => {
    if (!isProd) {
      console.error(...args);
      return;
    }
    const msg = formatArgs(args);
    void sendToServer('error', msg);
  },
  debug: (...args: unknown[]) => {
    if (!isProd) {
      // keep debug as console.log for easier dev visibility
      console.log(...args);
      return;
    }
    const msg = formatArgs(args);
    void sendToServer('debug', msg);
  }
};
