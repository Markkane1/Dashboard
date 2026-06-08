import { logger as clientLogger } from './logger-client';

const serverLogger = {
  info: (...args: any[]) => console.info(...args),
  warn: (...args: any[]) => console.warn(...args),
  error: (...args: any[]) => console.error(...args),
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(...args);
    }
  },
};

export const logger = typeof window === 'undefined' ? serverLogger : clientLogger;
