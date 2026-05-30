const express = require('express');
const router = express.Router();
const fs = require('fs');
const auth = require('../middleware/auth');
const { Lesson, User } = require('../models');
const { isRemoteVideoUrl, resolveLocalVideoPath } = require('../services/videoStorage');

/**
 * GET /api/video/:lessonId
 * Stream lesson video files using HTTP partial range streaming or redirect to external hosts.
 * Protects course material through JWT auth and enrollment validations.
 */
router.get('/:lessonId', auth, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user.id;

    // 1. Fetch lesson details to obtain video URL
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found." });
    }

    // 2. Authorization: Verify user is enrolled in the lesson's parent course
    const user = await User.findById(userId);
    if (!user || !user.enrolledCourses.includes(lesson.courseId.toString())) {
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
      filePath = resolveLocalVideoPath(videoUrl);
    } catch (pathError) {
      console.error("Invalid local video path:", pathError.message);
      return res.status(400).json({ error: "Invalid linked video path." });
    }
    
    if (!fs.existsSync(filePath)) {
      console.error(`Local video file not found at path: ${filePath}`);
      return res.status(404).json({ error: "Linked video file does not exist on disk." });
    }

    // A. Read the local video file size
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    // B. Parse Range Header parameter
    const range = req.headers.range;

    if (!range) {
      // No range requested - stream full video file content normally
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4'
      });
      return fs.createReadStream(filePath).pipe(res);
    }

    // C. Parse range request segments: e.g. "bytes=30000-50000"
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    // Validate boundaries
    if (start >= fileSize || end >= fileSize) {
      res.writeHead(416, {
        'Content-Range': `bytes */${fileSize}`
      });
      return res.end();
    }

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
    const fileStream = fs.createReadStream(filePath, { start, end });
    
    fileStream.on('error', (streamErr) => {
      console.error("ReadStream error occurred during video piping:", streamErr);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });

    fileStream.pipe(res);
  } catch (error) {
    console.error("Error streaming lesson video:", error);
    res.status(500).json({ error: "Internal server error occurred during video stream setup." });
  }
});

module.exports = router;
