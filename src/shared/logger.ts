import { logger as clientLogger } from './logger-client';

const serverLogger = {
  info: (...args: unknown[]) => console.info(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
  debug: (...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(...args);
    }
  },
};

export const logger = typeof window === 'undefined' ? serverLogger : clientLogger;
