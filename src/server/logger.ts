const pino = require('pino');
const pinoHttp = require('pino-http');
const path = require('path');
const fs = require('fs');

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const redact = {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers["set-cookie"]',
    'res.headers["set-cookie"]'
  ],
  censor: '[REDACTED]'
};

let logger;

if (process.env.NODE_ENV === 'production') {
  try {
    const rfs = require('rotating-file-stream');

    const logsDir = path.resolve(__dirname, '../../logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

    const fileStream = rfs.createStream('app-%Y-%m-%d.log', {
      interval: '1d', // rotate daily
      size: '100M', // rotate when file exceeds 100MB
      compress: 'gzip', // compress rotated files
      maxFiles: 10, // keep last 10 rotated files
      path: logsDir
    });

    const streams = [
      { stream: process.stdout },
      { stream: fileStream }
    ];

    logger = pino({ level, redact }, pino.multistream(streams));
  } catch (err) {
    // Fallback to stdout logger if rotation setup fails
    logger = pino({ level, redact });
    logger.warn({ err }, 'Failed to initialize rotating file stream, falling back to stdout');
  }
} else {
  const transport = {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' }
  };
  logger = pino({ level, redact, transport });
}

module.exports = {
  logger,
  pinoHttp: pinoHttp({ logger })
};

export {};
