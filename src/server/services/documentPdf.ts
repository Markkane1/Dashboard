const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { Worker } = require('worker_threads');

const cacheDir = path.resolve(__dirname, '../../../.cache/generated-docs');
const workerPath = path.join(__dirname, 'documentPdfWorker.ts');
const pendingJobs = new Map<string, Promise<Buffer>>();

function formatIssuedOn(value?: string | Date): string {
  const date = value ? new Date(value) : new Date();

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

async function getOrCreateDocumentPdf(cacheParts: unknown, workerData: Record<string, unknown>): Promise<Buffer> {
  const key = crypto
    .createHash('sha256')
    .update(JSON.stringify(cacheParts))
    .digest('hex');
  const filePath = path.join(cacheDir, `${key}.pdf`);

  try {
    return await fs.readFile(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  let pendingJob = pendingJobs.get(key);
  if (!pendingJob) {
    pendingJob = renderAndCachePdf(filePath, workerData).finally(() => pendingJobs.delete(key));
    pendingJobs.set(key, pendingJob);
  }

  return pendingJob;
}

async function renderAndCachePdf(filePath: string, workerData: Record<string, unknown>): Promise<Buffer> {
  const bytes = await renderPdfInWorker(workerData);
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(filePath, bytes);
  return bytes;
}

function renderPdfInWorker(workerData: Record<string, unknown>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, { workerData, execArgv: ['--require', 'tsx/cjs'] });

    worker.once('message', (message: Buffer | { error?: string; stack?: string }) => {
      if (!Buffer.isBuffer(message) && message?.error) {
        reject(new Error(message.stack || message.error));
        return;
      }

      resolve(Buffer.from(message as Buffer));
    });
    worker.once('error', reject);
    worker.once('exit', (code: number) => {
      if (code !== 0) {
        reject(new Error(`PDF worker exited with code ${code}`));
      }
    });
  });
}

module.exports = {
  formatIssuedOn,
  getOrCreateDocumentPdf
};

export {};
