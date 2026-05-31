import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:5000";

function buildBackendUrl(path: string) {
  return `${BACKEND_URL.replace(/\/$/, "")}${path}`;
}

export async function GET(req: NextRequest, { params }: { params: { courseId: string } }) {
  const download = req.nextUrl.searchParams.get("download");
  if (download === "1") {
    const backendUrl = buildBackendUrl(`/api/certificates/${params.courseId}/download`);
    const headers = new Headers();
    for (const [key, value] of req.headers.entries()) {
      if (key === "host") continue;
      if (value) headers.set(key, value);
    }

    const response = await fetch(backendUrl, {
      headers,
      redirect: "manual"
    });

    const forwardedHeaders = new Headers(response.headers);
    return new NextResponse(response.body, {
      status: response.status,
      headers: forwardedHeaders
    });
  }

  return NextResponse.json(
    { error: "Use ?download=1 to trigger certificate download or call /api/certificates/verify/[certificateId] to verify." },
    { status: 400 }
  );
}
