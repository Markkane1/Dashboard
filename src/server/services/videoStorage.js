const fs = require('fs');
const path = require('path');

const VIDEO_STORAGE = process.env.VIDEO_STORAGE || 'local';
const LOCAL_VIDEO_DIR = process.env.LOCAL_VIDEO_DIR
  ? path.resolve(process.env.LOCAL_VIDEO_DIR)
  : path.resolve(process.cwd(), 'uploads', 'videos');
const LOCAL_VIDEO_URL_PREFIX = '/uploads/videos/';

function ensureLocalVideoDir() {
  fs.mkdirSync(LOCAL_VIDEO_DIR, { recursive: true });
}

function getLocalVideoDir() {
  ensureLocalVideoDir();
  return LOCAL_VIDEO_DIR;
}

function getPublicVideoUrl(filename) {
  return `${LOCAL_VIDEO_URL_PREFIX}${filename}`;
}

function isRemoteVideoUrl(videoUrl) {
  return videoUrl.startsWith('http://') || videoUrl.startsWith('https://');
}

function resolveLocalVideoPath(videoUrl) {
  if (!videoUrl.startsWith(LOCAL_VIDEO_URL_PREFIX)) {
    throw new Error('Invalid local video URL.');
  }

  const relativePath = videoUrl.slice(LOCAL_VIDEO_URL_PREFIX.length);
  if (!relativePath || relativePath.includes('\0')) {
    throw new Error('Invalid local video path.');
  }

  const resolvedBaseDir = fs.realpathSync.native(getLocalVideoDir());
  const resolvedPath = path.resolve(resolvedBaseDir, relativePath);
  const basePrefix = resolvedBaseDir.endsWith(path.sep) ? resolvedBaseDir : `${resolvedBaseDir}${path.sep}`;

  if (resolvedPath !== resolvedBaseDir && !resolvedPath.startsWith(basePrefix)) {
    throw new Error('Local video path escapes the configured video directory.');
  }

  if (fs.existsSync(resolvedPath)) {
    const realPath = fs.realpathSync.native(resolvedPath);
    if (realPath !== resolvedBaseDir && !realPath.startsWith(basePrefix)) {
      throw new Error('Local video file resolves outside the configured video directory.');
    }
    return realPath;
  }

  return resolvedPath;
}

module.exports = {
  VIDEO_STORAGE,
  getLocalVideoDir,
  getPublicVideoUrl,
  isRemoteVideoUrl,
  resolveLocalVideoPath
};
