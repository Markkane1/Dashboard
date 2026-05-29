import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export class GenerateCertificateUseCase {
  async execute(
    name: string,
    courseTitle: string,
    completionDate: string,
    certificateId: string
  ): Promise<Uint8Array> {
    // 1. Create a fresh PDF document
    const pdfDoc = await PDFDocument.create();

    // 2. Add Landscape A4 Page (842pt width x 595pt height)
    const page = pdfDoc.addPage([842, 595]);

    // 3. Embed default Helvetica and Times Roman fonts
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

    // 4. Draw branded background vector lines
    // Golden outer border
    page.drawRectangle({
      x: 24,
      y: 24,
      width: 794,
      height: 547,
      borderColor: rgb(0.85, 0.65, 0.13), // Metallic Gold
      borderWidth: 6,
    });

    // Deep Navy inner border
    page.drawRectangle({
      x: 36,
      y: 36,
      width: 770,
      height: 523,
      borderColor: rgb(0.06, 0.08, 0.15), // Deep Navy slate
      borderWidth: 2,
    });

    // Top-Left HSL style Glowing Violet Vector Shape
    page.drawCircle({
      x: 36,
      y: 559,
      size: 90, // pdf-lib uses 'size' to represent circle radius
      color: rgb(0.55, 0.36, 0.96),
      opacity: 0.08,
    });

    // Bottom-Right HSL style Glowing Cyan Vector Shape
    page.drawCircle({
      x: 806,
      y: 36,
      size: 120, // pdf-lib uses 'size' to represent circle radius
      color: rgb(0.07, 0.92, 0.92),
      opacity: 0.06,
    });

    // 5. Draw Certificate Text and Titles
    // Branded Institution subtitle
    const brandText = "E L E A R N I N G   E P A";
    page.drawText(brandText, {
      x: 421 - helveticaBold.widthOfTextAtSize(brandText, 11) / 2,
      y: 495,
      size: 11,
      font: helveticaBold,
      color: rgb(0.55, 0.36, 0.96), // Glowing Violet accent
    });

    // Main Certificate Header
    const headerText = "CERTIFICATE OF COMPLETION";
    page.drawText(headerText, {
      x: 421 - helveticaBold.widthOfTextAtSize(headerText, 26) / 2,
      y: 430,
      size: 26,
      font: helveticaBold,
      color: rgb(0.06, 0.08, 0.15),
    });

    // Verifying statement
    const statementText = "This credentials verifies that the student";
    page.drawText(statementText, {
      x: 421 - timesItalic.widthOfTextAtSize(statementText, 15) / 2,
      y: 375,
      size: 15,
      font: timesItalic,
      color: rgb(0.4, 0.45, 0.5),
    });

    // Student Full Name (Large and Gold-glowing)
    page.drawText(name, {
      x: 421 - helveticaBold.widthOfTextAtSize(name, 34) / 2,
      y: 310,
      size: 34,
      font: helveticaBold,
      color: rgb(0.85, 0.65, 0.13), // Gold Metallic
    });

    // Course completion context
    const courseStatement = "has successfully completed the premium syllabus curriculum of";
    page.drawText(courseStatement, {
      x: 421 - helvetica.widthOfTextAtSize(courseStatement, 13) / 2,
      y: 255,
      size: 13,
      font: helvetica,
      color: rgb(0.3, 0.35, 0.4),
    });

    // Course Title (Large and Bold)
    page.drawText(courseTitle, {
      x: 421 - helveticaBold.widthOfTextAtSize(courseTitle, 20) / 2,
      y: 205,
      size: 20,
      font: helveticaBold,
      color: rgb(0.06, 0.08, 0.15),
    });

    // Date
    const dateText = `Completed on ${completionDate}`;
    page.drawText(dateText, {
      x: 421 - helvetica.widthOfTextAtSize(dateText, 12) / 2,
      y: 155,
      size: 12,
      font: helvetica,
      color: rgb(0.4, 0.45, 0.5),
    });

    // Branded bottom signatures
    page.drawText(`Certificate ID: ${certificateId}`, {
      x: 50,
      y: 60,
      size: 7.5,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });

    const certType = "Clean Architecture Certified";
    page.drawText(certType, {
      x: 792 - helveticaBold.widthOfTextAtSize(certType, 9.5),
      y: 60,
      size: 9.5,
      font: helveticaBold,
      color: rgb(0.06, 0.08, 0.15),
    });

    // 6. Save the PDF document as Bytes
    return pdfDoc.save();
  }
}
