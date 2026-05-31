let serverLogger: any = null;
try {
  // When running in Node (server), require the server logger
  if (typeof window === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const srv = require('../server/logger');
    serverLogger = srv && srv.logger ? srv.logger : null;
  }
} catch (e) {
  serverLogger = null;
}

import { logger as clientLogger } from './logger-client';

export const logger = serverLogger || clientLogger;
