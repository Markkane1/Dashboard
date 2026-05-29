import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export class GenerateDiplomaUseCase {
  async execute(
    name: string,
    trackTitle: string,
    completedCoursesTitles: string[],
    completionDate: string,
    diplomaHash: string
  ): Promise<Uint8Array> {
    // 1. Create a fresh PDF document
    const pdfDoc = await PDFDocument.create();

    // 2. Add Landscape A4 Page (842pt width x 595pt height)
    const page = pdfDoc.addPage([842, 595]);

    // 3. Embed default Helvetica and Times Roman fonts
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

    // 4. Draw high-tier double gold metallic borders
    // Outer bold golden border
    page.drawRectangle({
      x: 20,
      y: 20,
      width: 802,
      height: 555,
      borderColor: rgb(0.85, 0.65, 0.13), // Royal Gold
      borderWidth: 8,
    });

    // Inner thin golden border
    page.drawRectangle({
      x: 34,
      y: 34,
      width: 774,
      height: 527,
      borderColor: rgb(0.85, 0.65, 0.13), // Royal Gold
      borderWidth: 2.5,
    });

    // Deep Navy frame border
    page.drawRectangle({
      x: 42,
      y: 42,
      width: 758,
      height: 511,
      borderColor: rgb(0.06, 0.08, 0.15),
      borderWidth: 1.5,
    });

    // Deep decorative corner HSL glows
    page.drawCircle({
      x: 42,
      y: 553,
      size: 110,
      color: rgb(0.55, 0.36, 0.96), // HSL Violet
      opacity: 0.09,
    });

    page.drawCircle({
      x: 800,
      y: 42,
      size: 130,
      color: rgb(0.07, 0.92, 0.92), // HSL Cyan
      opacity: 0.08,
    });

    // 5. Draw Diploma Typography
    const brandText = "E L E A R N I N G   E P A   A C A D E M Y";
    page.drawText(brandText, {
      x: 421 - helveticaBold.widthOfTextAtSize(brandText, 12) / 2,
      y: 500,
      size: 12,
      font: helveticaBold,
      color: rgb(0.55, 0.36, 0.96),
    });

    // Royal Emblem / Symbol placeholder
    page.drawRectangle({
      x: 406,
      y: 440,
      width: 30,
      height: 30,
      borderColor: rgb(0.85, 0.65, 0.13),
      borderWidth: 2,
      color: rgb(0.06, 0.08, 0.15),
    });
    page.drawCircle({
      x: 421,
      y: 455,
      size: 6,
      color: rgb(0.85, 0.65, 0.13),
    });

    const titleText = "DIPLOMA IN ADVANCED FULL-STACK ENGINEERING";
    page.drawText(titleText, {
      x: 421 - helveticaBold.widthOfTextAtSize(titleText, 22) / 2,
      y: 395,
      size: 22,
      font: helveticaBold,
      color: rgb(0.06, 0.08, 0.15),
    });

    const statement = "Upon recommendation of the faculty, this diploma is proudly conferred upon";
    page.drawText(statement, {
      x: 421 - timesItalic.widthOfTextAtSize(statement, 15) / 2,
      y: 350,
      size: 15,
      font: timesItalic,
      color: rgb(0.4, 0.45, 0.5),
    });

    // Graduate Name
    page.drawText(name, {
      x: 421 - helveticaBold.widthOfTextAtSize(name, 36) / 2,
      y: 285,
      size: 36,
      font: helveticaBold,
      color: rgb(0.85, 0.65, 0.13), // Golden metallic
    });

    const trackStatement = `who has successfully satisfied all academic and practical requirements of the path`;
    page.drawText(trackStatement, {
      x: 421 - helvetica.widthOfTextAtSize(trackStatement, 12.5) / 2,
      y: 235,
      size: 12.5,
      font: helvetica,
      color: rgb(0.3, 0.35, 0.4),
    });

    // Pathway title
    page.drawText(trackTitle, {
      x: 421 - helveticaBold.widthOfTextAtSize(trackTitle, 16) / 2,
      y: 195,
      size: 16,
      font: helveticaBold,
      color: rgb(0.06, 0.08, 0.15),
    });

    // List completed courses as credentials
    const coursesListStr = `Credential Prereqs: ${completedCoursesTitles.join("  |  ")}`;
    page.drawText(coursesListStr, {
      x: 421 - helvetica.widthOfTextAtSize(coursesListStr, 9) / 2,
      y: 150,
      size: 9,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Date
    const dateText = `Conferred on ${completionDate}`;
    page.drawText(dateText, {
      x: 421 - helvetica.widthOfTextAtSize(dateText, 11) / 2,
      y: 110,
      size: 11,
      font: helvetica,
      color: rgb(0.4, 0.45, 0.5),
    });

    // Unique verification hashes
    page.drawText(`Diploma Verification Code: ${diplomaHash}`, {
      x: 55,
      y: 65,
      size: 7,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });

    const certType = "Clean Architecture Academy Dean";
    page.drawText(certType, {
      x: 787 - helveticaBold.widthOfTextAtSize(certType, 9.5),
      y: 65,
      size: 9.5,
      font: helveticaBold,
      color: rgb(0.06, 0.08, 0.15),
    });

    // 6. Save PDF document as Bytes
    return pdfDoc.save();
  }
}
