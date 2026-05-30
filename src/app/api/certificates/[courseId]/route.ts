import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { auth } from "@/../auth";
import { findUserByEmail } from "@/features/users/data/userDb";
import { fetchCourseById } from "@/infrastructure/api/courses";

interface CertificateRouteProps {
  params: {
    courseId: string;
  };
}

function safeFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function GET(_: Request, { params }: CertificateRouteProps) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await findUserByEmail(session.user.email);
  if (!user || !user.completedCourses?.includes(params.courseId)) {
    return NextResponse.json({ error: "Certificate is only available for completed courses." }, { status: 403 });
  }

  const course = await fetchCourseById(params.courseId);
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 595]);
  const { width, height } = page.getSize();
  const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawRectangle({
    x: 34,
    y: 34,
    width: width - 68,
    height: height - 68,
    borderColor: rgb(0.05, 0.32, 0.23),
    borderWidth: 3
  });

  page.drawText("Certificate of Completion", {
    x: 190,
    y: 450,
    size: 34,
    font: titleFont,
    color: rgb(0.05, 0.32, 0.23)
  });

  page.drawText("This certifies that", {
    x: 350,
    y: 380,
    size: 16,
    font: bodyFont,
    color: rgb(0.25, 0.29, 0.34)
  });

  const recipientName = session.user.name || user.name;
  const recipientSize = 28;
  const recipientWidth = titleFont.widthOfTextAtSize(recipientName, recipientSize);
  page.drawText(recipientName, {
    x: Math.max(60, (width - recipientWidth) / 2),
    y: 335,
    size: recipientSize,
    font: titleFont,
    color: rgb(0.02, 0.08, 0.12),
    maxWidth: width - 120,
    lineHeight: 34
  });

  page.drawText(`has successfully completed "${course.title}"`, {
    x: 150,
    y: 285,
    size: 16,
    font: bodyFont,
    color: rgb(0.25, 0.29, 0.34),
    maxWidth: 540
  });

  page.drawText(`Issued on ${new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  })}`, {
    x: 315,
    y: 220,
    size: 13,
    font: bodyFont,
    color: rgb(0.35, 0.39, 0.45)
  });

  page.drawText("InforMEA Learning", {
    x: 332,
    y: 115,
    size: 18,
    font: titleFont,
    color: rgb(0.05, 0.32, 0.23)
  });

  const pdfBytes = await pdfDoc.save();
  const filename = `certificate-${safeFilename(course.title || params.courseId)}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
