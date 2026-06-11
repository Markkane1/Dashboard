const { CertificateIssuance } = require('../models');

function normalizeCode(value: unknown, fallback: string) {
  const cleaned = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 8);

  return cleaned || fallback;
}

async function generateCertificateSerial(course: any, issuedAt = new Date()) {
  const year = issuedAt.getFullYear();
  const courseCode = normalizeCode(course?.category || course?.title, 'COURSE');
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const sequence = await CertificateIssuance.countDocuments({
    issuedAt: { $gte: yearStart, $lt: yearEnd }
  }) + 1;

  return `EPA-CKEPD-${year}-${courseCode}-${String(sequence).padStart(6, '0')}`;
}

module.exports = { generateCertificateSerial };

export {};
