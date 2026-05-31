const express = require('express');
const router = express.Router();
const { logger } = require('../logger');
import type { Request, Response } from 'express';

router.post('/', express.json(), (req: Request, res: Response) => {
  try {
    const { level, message, meta, url, ts } = req.body || {};
    if (level === 'error') {
      logger.error({ meta, url, ts }, message);
    } else if (level === 'warn') {
      logger.warn({ meta, url, ts }, message);
    } else if (level === 'debug') {
      logger.debug({ meta, url, ts }, message);
    } else {
      logger.info({ meta, url, ts }, message);
    }
    res.status(204).end();
  } catch (err) {
    logger.error({ err }, 'Failed to process client log');
    res.status(500).json({ error: 'Failed to process client log' });
  }
});

module.exports = router;
