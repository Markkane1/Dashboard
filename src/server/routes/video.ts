const express = require('express');
const router = express.Router();
const fs = require('fs');
const auth = require('../middleware/auth');
const { Lesson } = require('../models');
const { hasCourseAccess } = require('../services/enrollments');
const { isRemoteVideoUrl, resolveLocalVideoPath } = require('../services/videoStorage');
const { logger } = require('../logger');
import type { Request, Response } from 'express';

type AuthenticatedRequest = Request & { user: NonNullable<Request['user']> };

const DEFAULT_VIDEO_CHUNK_BYTES = Number(process.env.VIDEO_DEFAULT_CHUNK_BYTES || 1024 * 1024);
const MAX_VIDEO_CHUNK_BYTES = Number(process.env.VIDEO_MAX_CHUNK_BYTES || 5 * 1024 * 1024);
const MAX_CONCURRENT_VIDEO_STREAMS = Number(process.env.MAX_CONCURRENT_VIDEO_STREAMS || 25);

let activeVideoStreams = 0;
const videoStreamQueue: Array<() => void> = [];

function parseByteRange(rangeHeader: string | undefined, fileSize: number) {
  if (fileSize <= 0) {
    return null;
  }

  if (!rangeHeader) {
    return { start: 0, end: Math.min(DEFAULT_VIDEO_CHUNK_BYTES - 1, fileSize - 1) };
  }

  const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) {
    return null;
  }

  const [, rawStart, rawEnd] = match;
  let start;
  let end;

  if (!rawStart && rawEnd) {
    const suffixLength = Number(rawEnd);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      return null;
    }
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    start = rawStart ? Number(rawStart) : 0;
    end = rawEnd ? Number(rawEnd) : Math.min(start + DEFAULT_VIDEO_CHUNK_BYTES - 1, fileSize - 1);
  }

  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= fileSize) {
    return null;
  }

  end = Math.min(end, fileSize - 1, start + MAX_VIDEO_CHUNK_BYTES - 1);

  return { start, end };
}

function acquireVideoStreamSlot(): Promise<() => void> {
  return new Promise((resolve) => {
    const acquire = () => {
      activeVideoStreams += 1;
      let released = false;

      resolve(() => {
        if (released) return;
        released = true;
        activeVideoStreams = Math.max(0, activeVideoStreams - 1);
        videoStreamQueue.shift()?.();
      });
    };

    if (activeVideoStreams < MAX_CONCURRENT_VIDEO_STREAMS) {
      acquire();
      return;
    }

    videoStreamQueue.push(acquire);
  });
}

/**
 * GET /api/video/:lessonId
 * Stream lesson video files using HTTP partial range streaming or redirect to external hosts.
 * Protects course material through JWT auth and enrollment validations.
 */
router.get('/:lessonId', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { lessonId } = req.params;

    // 1. Fetch lesson details to obtain video URL
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found." });
    }

    // 2. Authorization: Verify user is enrolled in the lesson's parent course
    if (!(await hasCourseAccess(req.user, lesson.courseId))) {
      return res.status(403).json({ error: "Access denied. You must be enrolled in this course to access course media." });
    }

    const { videoUrl } = lesson;
    if (!videoUrl) {
      return res.status(404).json({ error: "No video file linked to this lesson." });
    }

    // 3. Handle External Video Hosts (redirect with 302 status)
    if (isRemoteVideoUrl(videoUrl)) {
      return res.redirect(302, videoUrl);
    }

    // 4. Handle Local File Streaming (HTTP Range Partial Responses)
    // Resolve absolute path from project root uploads folder
    let filePath;
    try {
      filePath = await resolveLocalVideoPath(videoUrl);
    } catch (pathError) {
      const error = pathError instanceof Error ? pathError : new Error(String(pathError));
      logger.warn({ err: error }, 'Invalid local video path');
      return res.status(400).json({ error: "Invalid linked video path." });
    }
    
    // A. Read the local video file size asynchronously
    let fileSize: number;
    try {
      const stat = await fs.promises.stat(filePath);
      fileSize = stat.size;
    } catch (statError: any) {
      if (statError.code === 'ENOENT') {
        logger.warn({ path: filePath }, 'Local video file not found');
        return res.status(404).json({ error: "Linked video file does not exist on disk." });
      }
      logger.error({ err: statError, path: filePath }, 'Failed to read local video file stats');
      return res.status(500).json({ error: "Failed to read video file." });
    }

    if (!req.headers.range) {
      const headers = {
        'Accept-Ranges': 'bytes',
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4'
      };

      res.writeHead(200, headers);
      const releaseStreamSlot = await acquireVideoStreamSlot();
      const fileStream = fs.createReadStream(filePath);
      let released = false;
      const releaseOnce = () => {
        if (released) return;
        released = true;
        releaseStreamSlot();
      };

      fileStream.on('error', (streamErr: Error) => {
        logger.error({ err: streamErr }, 'ReadStream error occurred during full video piping');
        releaseOnce();
        if (!res.headersSent) {
          res.status(500).end();
        }
      });
      fileStream.on('close', releaseOnce);
      res.on('close', releaseOnce);

      return fileStream.pipe(res);
    }

    // B. Parse Range Header parameter.
    const parsedRange = parseByteRange(req.headers.range, fileSize);

    // Validate boundaries
    if (!parsedRange) {
      res.writeHead(416, {
        'Content-Range': `bytes */${fileSize}`
      });
      return res.end();
    }

    const { start, end } = parsedRange;
    const chunkSize = (end - start) + 1;

    // D. Formulate Content range header arrays
    const headers = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4'
    };

    // E. Pipe HTTP Partial Content status code stream
    res.writeHead(206, headers);
    const releaseStreamSlot = await acquireVideoStreamSlot();
    const fileStream = fs.createReadStream(filePath, { start, end });
    let released = false;
    const releaseOnce = () => {
      if (released) return;
      released = true;
      releaseStreamSlot();
    };
    
    fileStream.on('error', (streamErr: Error) => {
      logger.error({ err: streamErr }, 'ReadStream error occurred during video piping');
      releaseOnce();
      if (!res.headersSent) {
        res.status(500).end();
      }
    });
    fileStream.on('close', releaseOnce);
    res.on('close', releaseOnce);

    fileStream.pipe(res);
  } catch (error) {
    logger.error({ err: error }, 'Error streaming lesson video');
    res.status(500).json({ error: "Internal server error occurred during video stream setup." });
  }
});

module.exports = router;

export {};
