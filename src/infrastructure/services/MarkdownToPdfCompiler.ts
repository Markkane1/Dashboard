import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { ICourseRepository } from "../../core/domain/repositories/ICourseRepository";

export class MarkdownToPdfCompiler {
  constructor(private courseRepository: ICourseRepository) {}

  async compile(courseId: string): Promise<Uint8Array | null> {
    // 1. Query the course with all nested modules & chapters populated
    const course = await this.courseRepository.findById(courseId, { includeChapters: true });
    if (!course || !course.modules || course.modules.length === 0) {
      return null;
    }

    // 2. Instantiate a fresh PDF document
    const pdfDoc = await PDFDocument.create();

    // Embed Helvetica and Helvetica-Bold
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // 3. Construct a beautiful portrait A4 cover page (595pt width x 842pt height)
    let page = pdfDoc.addPage([595, 842]);

    // Draw Cover Gold/Violet decorative border
    page.drawRectangle({
      x: 30,
      y: 30,
      width: 535,
      height: 782,
      borderColor: rgb(0.55, 0.36, 0.96), // Violet accent
      borderWidth: 2,
    });

    // Main cover titles
    page.drawText(course.title.toUpperCase(), {
      x: 50,
      y: 500,
      size: 22,
      font: helveticaBold,
      color: rgb(0.06, 0.08, 0.15),
    });

    page.drawText("OFFLINE STUDY HANDBOOK", {
      x: 50,
      y: 460,
      size: 13,
      font: helveticaBold,
      color: rgb(0.55, 0.36, 0.96),
    });

    page.drawText("Dynamic Offline Curriculum compiled for low-bandwidth learners.", {
      x: 50,
      y: 420,
      size: 11,
      font: helvetica,
      color: rgb(0.4, 0.45, 0.5),
    });

    page.drawText(`Syllabus Author: ${course.instructorName}`, {
      x: 50,
      y: 200,
      size: 11,
      font: helveticaBold,
      color: rgb(0.06, 0.08, 0.15),
    });

    page.drawText("ELearningEPA Clean Architecture Academy", {
      x: 50,
      y: 70,
      size: 9,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });

    // 4. Iterate sequentially through modules and chapters
    for (const mod of course.modules) {
      // Add Module Divider Page
      page = pdfDoc.addPage([595, 842]);

      page.drawText(mod.title, {
        x: 50,
        y: 600,
        size: 18,
        font: helveticaBold,
        color: rgb(0.55, 0.36, 0.96),
      });

      if (mod.description) {
        page.drawText(mod.description, {
          x: 50,
          y: 550,
          size: 11,
          font: helvetica,
          color: rgb(0.3, 0.35, 0.4),
        });
      }

      for (const chap of mod.chapters) {
        // Add Chapter Content Page
        page = pdfDoc.addPage([595, 842]);

        // Chapter Title Header
        page.drawText(chap.title, {
          x: 50,
          y: 760,
          size: 15,
          font: helveticaBold,
          color: rgb(0.06, 0.08, 0.15),
        });

        page.drawText(`Estimated Reading Time: ${chap.estimatedMinutes} minutes`, {
          x: 50,
          y: 738,
          size: 8.5,
          font: helvetica,
          color: rgb(0.5, 0.5, 0.5),
        });

        page.drawLine({
          start: { x: 50, y: 725 },
          end: { x: 545, y: 725 },
          thickness: 1,
          color: rgb(0.85, 0.85, 0.85),
        });

        // Simple Markdown Paging & Line Wrapping Drawer
        const lines = chap.contentMarkdown.split("\n");
        let currentY = 690;

        for (const line of lines) {
          const cleanLine = line.trim();
          if (cleanLine === "") {
            currentY -= 12;
            continue;
          }

          if (cleanLine.startsWith("#")) {
            const hText = cleanLine.replace(/#/g, "").trim();
            page.drawText(hText, {
              x: 50,
              y: currentY,
              size: 11.5,
              font: helveticaBold,
              color: rgb(0.06, 0.08, 0.15),
            });
            currentY -= 20;
          } else {
            // Draw standard line of text (simple word wrapping for width limits)
            const words = cleanLine.split(" ");
            let currentLine = "";

            for (const word of words) {
              const testLine = currentLine ? `${currentLine} ${word}` : word;
              const width = helvetica.widthOfTextAtSize(testLine, 9.5);

              if (width > 495) {
                // Render full row, reset buffer
                page.drawText(currentLine, {
                  x: 50,
                  y: currentY,
                  size: 9.5,
                  font: helvetica,
                  color: rgb(0.2, 0.2, 0.2),
                });
                currentY -= 15;
                currentLine = word;
              } else {
                currentLine = testLine;
              }

              // Paging bounds safety inside chapter loop
              if (currentY < 60) {
                page = pdfDoc.addPage([595, 842]);
                currentY = 780;
              }
            }

            if (currentLine) {
              page.drawText(currentLine, {
                x: 50,
                y: currentY,
                size: 9.5,
                font: helvetica,
                color: rgb(0.2, 0.2, 0.2),
              });
              currentY -= 15;
            }
          }

          // Paging bounds safety check
          if (currentY < 60) {
            page = pdfDoc.addPage([595, 842]);
            currentY = 780;
          }
        }

        // Footer stamp
        page.drawText(`Study Handbook | Chapter: ${chap.title}`, {
          x: 50,
          y: 35,
          size: 7.5,
          font: helvetica,
          color: rgb(0.6, 0.6, 0.6),
        });
      }
    }

    // 5. Output PDF Bytes
    return pdfDoc.save();
  }
}
