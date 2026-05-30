const fs = require('fs');
const path = require('path');

const VIDEO_STORAGE = process.env.VIDEO_STORAGE || 'local';
const LOCAL_VIDEO_DIR = process.env.LOCAL_VIDEO_DIR
  ? path.resolve(process.env.LOCAL_VIDEO_DIR)
  : path.join(process.cwd(), 'uploads', 'videos');

function ensureLocalVideoDir() {
  fs.mkdirSync(LOCAL_VIDEO_DIR, { recursive: true });
}

function getLocalVideoDir() {
  ensureLocalVideoDir();
  return LOCAL_VIDEO_DIR;
}

function getPublicVideoUrl(filename) {
  return `/uploads/videos/${filename}`;
}

function isRemoteVideoUrl(videoUrl) {
  return videoUrl.startsWith('http://') || videoUrl.startsWith('https://');
}

function resolveLocalVideoPath(videoUrl) {
  const normalizedUrl = videoUrl.replace(/^\/+/, '');
  return path.join(process.cwd(), normalizedUrl);
}

module.exports = {
  VIDEO_STORAGE,
  getLocalVideoDir,
  getPublicVideoUrl,
  isRemoteVideoUrl,
  resolveLocalVideoPath
};
