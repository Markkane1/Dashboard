const { parentPort, workerData } = require('worker_threads');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

type CertificateInput = {
  type: 'certificate';
  recipientName: string;
  courseTitle: string;
  issuedOn: string;
  certificateId: string;
  verificationUrl: string;
};

type DiplomaInput = {
  type: 'diploma';
  recipientName: string;
  diplomaTitle: string;
  requiredCourseCount: number;
  issuedOn: string;
};

async function buildCertificate(input: CertificateInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 595]);
  const { width, height } = page.getSize();
  const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const recipientSize = 28;
  const recipientWidth = titleFont.widthOfTextAtSize(input.recipientName, recipientSize);

  page.drawRectangle({
    x: 34,
    y: 34,
    width: width - 68,
    height: height - 68,
    borderColor: rgb(0.05, 0.32, 0.23),
    borderWidth: 3
  });
  page.drawText('Certificate of Completion', {
    x: 190,
    y: 450,
    size: 34,
    font: titleFont,
    color: rgb(0.05, 0.32, 0.23)
  });
  page.drawText('This certifies that', {
    x: 350,
    y: 380,
    size: 16,
    font: bodyFont,
    color: rgb(0.25, 0.29, 0.34)
  });
  page.drawText(input.recipientName, {
    x: Math.max(60, (width - recipientWidth) / 2),
    y: 335,
    size: recipientSize,
    font: titleFont,
    color: rgb(0.02, 0.08, 0.12),
    maxWidth: width - 120
  });
  page.drawText(`has successfully completed "${input.courseTitle}"`, {
    x: 150,
    y: 285,
    size: 16,
    font: bodyFont,
    color: rgb(0.25, 0.29, 0.34),
    maxWidth: 540
  });
  page.drawText(`Issued on ${input.issuedOn}`, {
    x: 315,
    y: 220,
    size: 13,
    font: bodyFont,
    color: rgb(0.35, 0.39, 0.45)
  });
  page.drawText('EPA Elearning', {
    x: 332,
    y: 115,
    size: 18,
    font: titleFont,
    color: rgb(0.05, 0.32, 0.23)
  });
  page.drawText(`Certificate ID: ${input.certificateId}`, {
    x: 60,
    y: 75,
    size: 10,
    font: bodyFont,
    color: rgb(0.35, 0.39, 0.45)
  });
  page.drawText(`Verify: ${input.verificationUrl}`, {
    x: 60,
    y: 58,
    size: 10,
    font: bodyFont,
    color: rgb(0.35, 0.39, 0.45),
    maxWidth: width - 120
  });

  return pdfDoc.save();
}

async function buildDiploma(input: DiplomaInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 595]);
  const { width, height } = page.getSize();
  const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const recipientSize = 28;
  const recipientWidth = titleFont.widthOfTextAtSize(input.recipientName, recipientSize);

  page.drawRectangle({
    x: 34,
    y: 34,
    width: width - 68,
    height: height - 68,
    borderColor: rgb(0.72, 0.45, 0.12),
    borderWidth: 4
  });
  page.drawText('Specialist Diploma', {
    x: 265,
    y: 455,
    size: 36,
    font: titleFont,
    color: rgb(0.55, 0.32, 0.08)
  });
  page.drawText('Awarded to', {
    x: 372,
    y: 390,
    size: 15,
    font: bodyFont,
    color: rgb(0.25, 0.29, 0.34)
  });
  page.drawText(input.recipientName, {
    x: Math.max(60, (width - recipientWidth) / 2),
    y: 345,
    size: recipientSize,
    font: titleFont,
    color: rgb(0.02, 0.08, 0.12),
    maxWidth: width - 120
  });
  page.drawText('for completing the multi-course pathway', {
    x: 282,
    y: 295,
    size: 15,
    font: bodyFont,
    color: rgb(0.25, 0.29, 0.34)
  });
  page.drawText(input.diplomaTitle, {
    x: 120,
    y: 255,
    size: 20,
    font: titleFont,
    color: rgb(0.05, 0.32, 0.23),
    maxWidth: 600
  });
  page.drawText(`${input.requiredCourseCount} required courses completed`, {
    x: 310,
    y: 200,
    size: 13,
    font: bodyFont,
    color: rgb(0.35, 0.39, 0.45)
  });
  page.drawText(`Issued on ${input.issuedOn}`, {
    x: 317,
    y: 165,
    size: 13,
    font: bodyFont,
    color: rgb(0.35, 0.39, 0.45)
  });
  page.drawText('EPA Elearning', {
    x: 332,
    y: 110,
    size: 18,
    font: titleFont,
    color: rgb(0.55, 0.32, 0.08)
  });

  return pdfDoc.save();
}

(async () => {
  const data = workerData as CertificateInput | DiplomaInput;
  const bytes = data.type === 'diploma'
    ? await buildDiploma(data)
    : await buildCertificate(data);

  parentPort?.postMessage(Buffer.from(bytes));
})().catch((error) => {
  const err = error instanceof Error ? error : new Error(String(error));
  parentPort?.postMessage({
    error: err.message,
    stack: err.stack
  });
});

export {};
