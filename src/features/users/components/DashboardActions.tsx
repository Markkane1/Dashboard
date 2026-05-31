"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface ActionProps {
  courseId: string;
}

async function enrollmentAction(action: "complete" | "unenroll", courseId: string) {
  const res = await fetch(`/api/enrollments/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ courseId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }
  return body;
}

export function MarkCompleteButton({ courseId }: ActionProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      await enrollmentAction("complete", courseId);
      router.refresh();
    } catch (error) {
      console.error("Complete course error:", error);
      alert(error instanceof Error ? error.message : "Failed to mark course as completed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleComplete}
      disabled={isLoading}
      className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
    >
      {isLoading ? "Completing..." : "Mark Complete ✓"}
    </button>
  );
}

export function UnenrollButton({ courseId }: ActionProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleUnenroll = async () => {
    if (!confirm("Are you sure you want to unenroll from this course?")) {
      return;
    }
    setIsLoading(true);
    try {
      await enrollmentAction("unenroll", courseId);
      router.refresh();
    } catch (error) {
      console.error("Unenroll course error:", error);
      alert(error instanceof Error ? error.message : "Failed to unenroll.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleUnenroll}
      disabled={isLoading}
      className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
    >
      {isLoading ? "Unenrolling..." : "Unenroll"}
    </button>
  );
}

function getFilename(res: Response, fallback: string) {
  const disposition = res.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
}

export function AuthenticatedDownloadButton({
  downloadUrl,
  label,
  fallbackFilename,
  className,
}: {
  downloadUrl: string;
  label: string;
  fallbackFilename: string;
  className?: string;
}) {
  const { data: session } = useSession();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!session?.apiAccessToken || isDownloading) return;

    setIsDownloading(true);
    try {
      const res = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${session.apiAccessToken}`,
        },
      });
      if (!res.ok) {
        throw new Error(`Download failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = getFilename(res, fallbackFilename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("Authenticated download failed:", error);
      alert("Download failed. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={isDownloading || !session?.apiAccessToken}
      className={className || "mt-3 block w-full rounded-md bg-forest py-2 text-center text-xs font-bold text-white hover:bg-emerald-800 transition-colors disabled:cursor-not-allowed disabled:opacity-50"}
    >
      {isDownloading ? "Downloading..." : label}
    </button>
  );
}

export function DownloadCertificateButton({ downloadUrl }: { downloadUrl: string }) {
  return (
    <AuthenticatedDownloadButton
      downloadUrl={downloadUrl}
      label="Download Certificate"
      fallbackFilename="certificate.pdf"
    />
  );
}
