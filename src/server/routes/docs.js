const express = require('express');
const router = express.Router();
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const auth = require('../middleware/auth');
const { Course, User } = require('../models');

function safeFilename(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function sendPdf(res, bytes, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(bytes));
}

function getRequiredCourseIds(diploma, courses) {
  if (Array.isArray(diploma.diplomaRequiredCourseIds) && diploma.diplomaRequiredCourseIds.length > 0) {
    return diploma.diplomaRequiredCourseIds;
  }

  return courses
    .filter((course) => (
      course.category === diploma.category &&
      !course.isDiploma &&
      !course.isExternal
    ))
    .map((course) => course._id.toString());
}

async function generateCertificate(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.completedCourses.includes(req.params.courseId)) {
      return res.status(403).json({ error: 'Certificate is only available for completed courses.' });
    }

    const course = await Course.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([842, 595]);
    const { width, height } = page.getSize();
    const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const recipientName = req.user.name || user.name;
    const recipientSize = 28;
    const recipientWidth = titleFont.widthOfTextAtSize(recipientName, recipientSize);

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
    page.drawText(recipientName, {
      x: Math.max(60, (width - recipientWidth) / 2),
      y: 335,
      size: recipientSize,
      font: titleFont,
      color: rgb(0.02, 0.08, 0.12),
      maxWidth: width - 120
    });
    page.drawText(`has successfully completed "${course.title}"`, {
      x: 150,
      y: 285,
      size: 16,
      font: bodyFont,
      color: rgb(0.25, 0.29, 0.34),
      maxWidth: 540
    });
    page.drawText(`Issued on ${new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}`, {
      x: 315,
      y: 220,
      size: 13,
      font: bodyFont,
      color: rgb(0.35, 0.39, 0.45)
    });
    page.drawText('InforMEA Learning', {
      x: 332,
      y: 115,
      size: 18,
      font: titleFont,
      color: rgb(0.05, 0.32, 0.23)
    });

    const pdfBytes = await pdfDoc.save();
    sendPdf(res, pdfBytes, `certificate-${safeFilename(course.title)}.pdf`);
  } catch (error) {
    console.error('Error generating certificate PDF:', error);
    res.status(500).json({ error: 'Failed to generate certificate.' });
  }
}

router.get('/certificates/:courseId/download', auth, generateCertificate);
router.get('/:courseId/download', auth, generateCertificate);

router.get('/diploma', auth, async (req, res) => {
  try {
    const { diplomaId } = req.query;
    if (!diplomaId) {
      return res.status(400).json({ error: 'diplomaId is required.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const diploma = await Course.findById(diplomaId);
    if (!diploma || !diploma.isDiploma) {
      return res.status(400).json({ error: 'Requested course is not a diploma track.' });
    }

    const courses = await Course.find();
    const requiredCourseIds = getRequiredCourseIds(diploma, courses);
    const missingCourseIds = requiredCourseIds.filter((courseId) => !user.completedCourses.includes(courseId));

    if (requiredCourseIds.length === 0 || missingCourseIds.length > 0) {
      return res.status(403).json({
        error: 'Complete all required courses before downloading this diploma.',
        requiredCourseIds,
        missingCourseIds
      });
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([842, 595]);
    const { width, height } = page.getSize();
    const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const recipientName = req.user.name || user.name;
    const recipientSize = 28;
    const recipientWidth = titleFont.widthOfTextAtSize(recipientName, recipientSize);

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
    page.drawText(recipientName, {
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
    page.drawText(diploma.title, {
      x: 120,
      y: 255,
      size: 20,
      font: titleFont,
      color: rgb(0.05, 0.32, 0.23),
      maxWidth: 600
    });
    page.drawText(`${requiredCourseIds.length} required courses completed`, {
      x: 310,
      y: 200,
      size: 13,
      font: bodyFont,
      color: rgb(0.35, 0.39, 0.45)
    });
    page.drawText(`Issued on ${new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}`, {
      x: 317,
      y: 165,
      size: 13,
      font: bodyFont,
      color: rgb(0.35, 0.39, 0.45)
    });
    page.drawText('InforMEA Learning', {
      x: 332,
      y: 110,
      size: 18,
      font: titleFont,
      color: rgb(0.55, 0.32, 0.08)
    });

    const pdfBytes = await pdfDoc.save();
    sendPdf(res, pdfBytes, `diploma-${safeFilename(diploma.title)}.pdf`);
  } catch (error) {
    console.error('Error generating diploma PDF:', error);
    res.status(500).json({ error: 'Failed to generate diploma.' });
  }
});

module.exports = router;
