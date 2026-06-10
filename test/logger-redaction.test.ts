const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const pino = require('pino');

const redact = {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers["set-cookie"]',
    'res.headers["set-cookie"]'
  ],
  censor: '[REDACTED]'
};

describe('logger redaction', () => {
  it('redacts bearer tokens and cookies from structured request logs', () => {
    const output: string[] = [];
    const destination = {
      write(line: string) {
        output.push(line);
      }
    };
    const logger = pino({ redact }, destination);

    logger.info({
      req: {
        headers: {
          authorization: 'Bearer secret.jwt.value',
          cookie: 'session=secret-cookie',
        }
      },
      res: {
        headers: {
          'set-cookie': 'session=secret-cookie'
        }
      }
    }, 'request complete');

    const logged = output.join('');
    assert.match(logged, /\[REDACTED\]/);
    assert.doesNotMatch(logged, /secret\.jwt\.value/);
    assert.doesNotMatch(logged, /secret-cookie/);
  });
});

export {};
