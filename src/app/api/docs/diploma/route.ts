import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { auth } from "@/../auth";
import { findUserByEmail } from "@/features/users/data/userDb";
import { fetchCourseById, fetchCourses } from "@/infrastructure/api/courses";

function safeFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function getRequiredCourseIds(diploma: Awaited<ReturnType<typeof fetchCourseById>>, courses: Awaited<ReturnType<typeof fetchCourses>>) {
  if (diploma.diplomaRequiredCourseIds && diploma.diplomaRequiredCourseIds.length > 0) {
    return diploma.diplomaRequiredCourseIds;
  }

  return courses
    .filter((course) => course.category === diploma.category && !course.isDiploma && !course.isExternal)
    .map((course) => course.id);
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const diplomaId = searchParams.get("diplomaId");
  if (!diplomaId) {
    return NextResponse.json({ error: "diplomaId is required" }, { status: 400 });
  }

  const user = await findUserByEmail(session.user.email);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const courses = await fetchCourses();
  const diploma = await fetchCourseById(diplomaId);
  if (!diploma.isDiploma) {
    return NextResponse.json({ error: "Requested course is not a diploma track." }, { status: 400 });
  }

  const requiredCourseIds = getRequiredCourseIds(diploma, courses);
  const completedCourseIds = user.completedCourses || [];
  const missingCourseIds = requiredCourseIds.filter((courseId) => !completedCourseIds.includes(courseId));

  if (requiredCourseIds.length === 0 || missingCourseIds.length > 0) {
    return NextResponse.json(
      {
        error: "Complete all required courses before downloading this diploma.",
        requiredCourseIds,
        missingCourseIds
      },
      { status: 403 }
    );
  }

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
    borderColor: rgb(0.72, 0.45, 0.12),
    borderWidth: 4
  });

  page.drawText("Specialist Diploma", {
    x: 265,
    y: 455,
    size: 36,
    font: titleFont,
    color: rgb(0.55, 0.32, 0.08)
  });

  page.drawText("Awarded to", {
    x: 372,
    y: 390,
    size: 15,
    font: bodyFont,
    color: rgb(0.25, 0.29, 0.34)
  });

  const recipientName = session.user.name || user.name;
  const recipientSize = 28;
  const recipientWidth = titleFont.widthOfTextAtSize(recipientName, recipientSize);
  page.drawText(recipientName, {
    x: Math.max(60, (width - recipientWidth) / 2),
    y: 345,
    size: recipientSize,
    font: titleFont,
    color: rgb(0.02, 0.08, 0.12),
    maxWidth: width - 120
  });

  page.drawText(`for completing the multi-course pathway`, {
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

  page.drawText(`Issued on ${new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  })}`, {
    x: 317,
    y: 165,
    size: 13,
    font: bodyFont,
    color: rgb(0.35, 0.39, 0.45)
  });

  page.drawText("InforMEA Learning", {
    x: 332,
    y: 110,
    size: 18,
    font: titleFont,
    color: rgb(0.55, 0.32, 0.08)
  });

  const pdfBytes = await pdfDoc.save();
  const filename = `diploma-${safeFilename(diploma.title || diplomaId)}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
