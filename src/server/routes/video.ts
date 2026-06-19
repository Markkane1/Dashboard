const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Lesson } = require('../models');
const { hasCourseAccess } = require('../services/enrollments');
const { hasPermission, PERMISSIONS } = require('../../shared/permissions');
const {
  getVideoStorageKey,
  isRemoteVideoUrl,
  VideoStorageNotImplementedError,
  videoStorageProvider
} = require('../services/videoStorage');
const { logger } = require('../logger');
import type { Request, Response } from 'express';

type AuthenticatedRequest = Request & { user: NonNullable<Request['user']> };

const MAX_CONCURRENT_VIDEO_STREAMS = Number(process.env.MAX_CONCURRENT_VIDEO_STREAMS || 25);

let activeVideoStreams = 0;
const videoStreamQueue: Array<() => void> = [];

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

    if (!lesson.isPublished && !hasPermission(req.user, PERMISSIONS.MANAGE_CONTENT)) {
      return res.status(403).json({ error: "Access denied. This lesson is not published yet." });
    }

    const { videoUrl } = lesson;
    if (!videoUrl) {
      return res.status(404).json({ error: "No video file linked to this lesson." });
    }

    // 3. Handle External Video Hosts (redirect with 302 status)
    if (isRemoteVideoUrl(videoUrl)) {
      return res.redirect(302, videoUrl);
    }

    const key = getVideoStorageKey(videoUrl);

    try {
      const exists = await videoStorageProvider.exists(key);
      if (!exists) {
        return res.status(404).json({ error: "Linked video file does not exist in storage." });
      }

      const streamResult = await videoStorageProvider.getStream(key, req.headers.range);

      if (streamResult.status === 416) {
        res.writeHead(416, {
          'Content-Range': streamResult.contentRange || 'bytes */0'
        });
        return res.end();
      }

      res.writeHead(streamResult.status, {
        'Content-Type': streamResult.contentType,
        'Content-Length': streamResult.contentLength,
        ...(streamResult.acceptRanges ? { 'Accept-Ranges': streamResult.acceptRanges } : {}),
        ...(streamResult.contentRange ? { 'Content-Range': streamResult.contentRange } : {})
      });

      const releaseStreamSlot = await acquireVideoStreamSlot();
      let released = false;
      const releaseOnce = () => {
        if (released) return;
        released = true;
        releaseStreamSlot();
      };

      streamResult.stream.on('error', (streamErr: Error) => {
        logger.error({ err: streamErr }, 'Error occurred during video streaming');
        releaseOnce();
        if (!res.headersSent) {
          res.status(500).end();
        }
      });

      streamResult.stream.on('close', releaseOnce);
      res.on('close', releaseOnce);

      streamResult.stream.pipe(res);
    } catch (streamError) {
      logger.error({ err: streamError, key }, 'Failed to stream video file');
      if (streamError instanceof VideoStorageNotImplementedError) {
        return res.status(501).json({ error: "Configured video storage provider is not implemented for streaming yet." });
      }
      return res.status(500).json({ error: "Failed to stream video file." });
    }
  } catch (error) {
    logger.error({ err: error }, 'Error streaming lesson video');
    res.status(500).json({ error: "Internal server error occurred during video stream setup." });
  }
});

module.exports = router;
