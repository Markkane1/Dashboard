const fs = require('fs');
const path = require('path');

const VIDEO_STORAGE = process.env.VIDEO_STORAGE || 'local';
const LOCAL_VIDEO_DIR = process.env.LOCAL_VIDEO_DIR
  ? path.resolve(process.env.LOCAL_VIDEO_DIR)
  : path.resolve(process.cwd(), 'uploads', 'videos');
const LOCAL_VIDEO_URL_PREFIX = '/uploads/videos/';

const DEFAULT_VIDEO_CHUNK_BYTES = Number(process.env.VIDEO_DEFAULT_CHUNK_BYTES || 1024 * 1024);
const MAX_VIDEO_CHUNK_BYTES = Number(process.env.VIDEO_MAX_CHUNK_BYTES || 5 * 1024 * 1024);

function ensureLocalVideoDir(): void {
  fs.mkdirSync(LOCAL_VIDEO_DIR, { recursive: true });
}

// Ensure the local video directory is created once at application startup.
ensureLocalVideoDir();

function getLocalVideoDir(): string {
  return LOCAL_VIDEO_DIR;
}

function getPublicVideoUrl(filename: string): string {
  return `${LOCAL_VIDEO_URL_PREFIX}${filename}`;
}

function isRemoteVideoUrl(videoUrl: string): boolean {
  return videoUrl.startsWith('http://') || videoUrl.startsWith('https://');
}

function getVideoStorageKey(videoUrlOrKey: string): string {
  if (!videoUrlOrKey || videoUrlOrKey.includes('\0')) {
    throw new Error('Invalid video storage key.');
  }
  return videoUrlOrKey.startsWith(LOCAL_VIDEO_URL_PREFIX)
    ? videoUrlOrKey.slice(LOCAL_VIDEO_URL_PREFIX.length)
    : videoUrlOrKey;
}

async function resolveLocalVideoPath(videoUrl: string): Promise<string> {
  if (!videoUrl.startsWith(LOCAL_VIDEO_URL_PREFIX)) {
    throw new Error('Invalid local video URL.');
  }

  const relativePath = getVideoStorageKey(videoUrl);
  if (!relativePath || relativePath.includes('\0')) {
    throw new Error('Invalid local video path.');
  }

  const resolvedBaseDir = await fs.promises.realpath(getLocalVideoDir());
  const resolvedPath = path.resolve(resolvedBaseDir, relativePath);
  const basePrefix = resolvedBaseDir.endsWith(path.sep) ? resolvedBaseDir : `${resolvedBaseDir}${path.sep}`;

  if (resolvedPath !== resolvedBaseDir && !resolvedPath.startsWith(basePrefix)) {
    throw new Error('Local video path escapes the configured video directory.');
  }

  try {
    await fs.promises.stat(resolvedPath);
    const realPath = await fs.promises.realpath(resolvedPath);
    if (realPath !== resolvedBaseDir && !realPath.startsWith(basePrefix)) {
      throw new Error('Local video file resolves outside the configured video directory.');
    }
    return realPath;
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  return resolvedPath;
}

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

export interface StoredVideo {
  key: string;
  url: string;
}

export interface StreamResult {
  stream: NodeJS.ReadableStream;
  contentLength: number;
  contentType: string;
  acceptRanges?: string;
  contentRange?: string;
  status: number;
}

export interface VideoStorageProvider {
  upload(file: Express.Multer.File): Promise<StoredVideo>;
  getStream(key: string, range?: string): Promise<StreamResult>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

class VideoStorageNotImplementedError extends Error {
  statusCode = 501;

  constructor(providerName: string, operation: string, requiredEnv: string[]) {
    super(`${providerName} video storage ${operation} is not implemented in this build. Required configuration: ${requiredEnv.join(', ') || 'none'}.`);
    this.name = 'VideoStorageNotImplementedError';
  }
}

class LocalVideoStorageProvider implements VideoStorageProvider {
  async upload(file: Express.Multer.File): Promise<StoredVideo> {
    const destination = path.join(LOCAL_VIDEO_DIR, file.filename);
    if (path.resolve(file.path) !== path.resolve(destination)) {
      await fs.promises.rename(file.path, destination);
    }
    return {
      key: file.filename,
      url: getPublicVideoUrl(file.filename)
    };
  }

  async getStream(key: string, rangeHeader?: string): Promise<StreamResult> {
    const filePath = await resolveLocalVideoPath(getPublicVideoUrl(key));
    const stat = await fs.promises.stat(filePath);
    const fileSize = stat.size;

    if (!rangeHeader) {
      const stream = fs.createReadStream(filePath);
      return {
        stream,
        contentLength: fileSize,
        contentType: 'video/mp4',
        acceptRanges: 'bytes',
        status: 200
      };
    }

    const parsedRange = parseByteRange(rangeHeader, fileSize);
    if (!parsedRange) {
      const Readable = require('stream').Readable;
      return {
        stream: new Readable({
          read() {
            this.push(null);
          }
        }),
        contentLength: 0,
        contentType: 'video/mp4',
        contentRange: `bytes */${fileSize}`,
        status: 416
      };
    }

    const { start, end } = parsedRange;
    const chunkSize = (end - start) + 1;
    const stream = fs.createReadStream(filePath, { start, end });

    return {
      stream,
      contentLength: chunkSize,
      contentType: 'video/mp4',
      acceptRanges: 'bytes',
      contentRange: `bytes ${start}-${end}/${fileSize}`,
      status: 206
    };
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = await resolveLocalVideoPath(getPublicVideoUrl(key));
      await fs.promises.unlink(filePath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = await resolveLocalVideoPath(getPublicVideoUrl(key));
      const stat = await fs.promises.stat(filePath);
      return stat.isFile();
    } catch {
      return false;
    }
  }
}

class S3VideoStorageProvider implements VideoStorageProvider {
  private requiredEnv = ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];

  async upload(_file: Express.Multer.File): Promise<StoredVideo> {
    throw new VideoStorageNotImplementedError('S3-compatible', 'upload', this.requiredEnv);
  }

  async getStream(_key: string, _range?: string): Promise<StreamResult> {
    throw new VideoStorageNotImplementedError('S3-compatible', 'streaming', this.requiredEnv);
  }

  async delete(_key: string): Promise<void> {
    throw new VideoStorageNotImplementedError('S3-compatible', 'delete', this.requiredEnv);
  }

  async exists(_key: string): Promise<boolean> {
    throw new VideoStorageNotImplementedError('S3-compatible', 'exists check', this.requiredEnv);
  }
}

class MinIOVideoStorageProvider implements VideoStorageProvider {
  private requiredEnv = ['MINIO_ENDPOINT', 'MINIO_BUCKET', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY'];

  async upload(_file: Express.Multer.File): Promise<StoredVideo> {
    throw new VideoStorageNotImplementedError('MinIO', 'upload', this.requiredEnv);
  }

  async getStream(_key: string, _range?: string): Promise<StreamResult> {
    throw new VideoStorageNotImplementedError('MinIO', 'streaming', this.requiredEnv);
  }

  async delete(_key: string): Promise<void> {
    throw new VideoStorageNotImplementedError('MinIO', 'delete', this.requiredEnv);
  }

  async exists(_key: string): Promise<boolean> {
    throw new VideoStorageNotImplementedError('MinIO', 'exists check', this.requiredEnv);
  }
}

class AzureBlobVideoStorageProvider implements VideoStorageProvider {
  private requiredEnv = ['AZURE_STORAGE_CONNECTION_STRING', 'AZURE_STORAGE_CONTAINER'];

  async upload(_file: Express.Multer.File): Promise<StoredVideo> {
    throw new VideoStorageNotImplementedError('Azure Blob', 'upload', this.requiredEnv);
  }

  async getStream(_key: string, _range?: string): Promise<StreamResult> {
    throw new VideoStorageNotImplementedError('Azure Blob', 'streaming', this.requiredEnv);
  }

  async delete(_key: string): Promise<void> {
    throw new VideoStorageNotImplementedError('Azure Blob', 'delete', this.requiredEnv);
  }

  async exists(_key: string): Promise<boolean> {
    throw new VideoStorageNotImplementedError('Azure Blob', 'exists check', this.requiredEnv);
  }
}

let videoStorageProvider: VideoStorageProvider;

switch (VIDEO_STORAGE.toLowerCase()) {
  case 's3':
    videoStorageProvider = new S3VideoStorageProvider();
    break;
  case 'minio':
    videoStorageProvider = new MinIOVideoStorageProvider();
    break;
  case 'azure':
    videoStorageProvider = new AzureBlobVideoStorageProvider();
    break;
  case 'local':
  default:
    videoStorageProvider = new LocalVideoStorageProvider();
    break;
}

module.exports = {
  VIDEO_STORAGE,
  getLocalVideoDir,
  getPublicVideoUrl,
  getVideoStorageKey,
  isRemoteVideoUrl,
  resolveLocalVideoPath,
  VideoStorageNotImplementedError,
  videoStorageProvider
};
