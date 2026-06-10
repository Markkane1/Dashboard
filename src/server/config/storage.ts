const storageConfig = {
  maxVideoSize: Number(process.env.VIDEO_MAX_UPLOAD_SIZE_BYTES || 500 * 1024 * 1024),
  allowedVideoTypes: ['video/mp4'],
  allowedVideoExtensions: ['.mp4']
};

module.exports = { storageConfig };
export {};
