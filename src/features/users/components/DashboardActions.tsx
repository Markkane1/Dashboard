"use client";

import React, { useState } from "react";
import { logger } from '@/shared/logger';
import { useRouter } from "next/navigation";
import { ConfirmDialog, StatusBanner } from "@/shared/components/ui/DesignSystem";

interface ActionProps {
  courseId: string;
}

async function enrollmentAction(action: "unenroll", courseId: string) {
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

export function UnenrollButton({ courseId }: ActionProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleUnenroll = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      await enrollmentAction("unenroll", courseId);
      setIsConfirmOpen(false);
      router.refresh();
    } catch (error) {
      logger.error("Unenroll course error:", error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to unenroll.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {errorMessage ? (
        <StatusBanner variant="error" title={errorMessage} className="col-span-full py-2 text-xs" />
      ) : null}
      <button
        onClick={() => setIsConfirmOpen(true)}
        disabled={isLoading}
        className="btn-secondary flex-1 px-3 py-2 text-xs"
      >
        {isLoading ? "Unenrolling..." : "Unenroll"}
      </button>
      <ConfirmDialog
        open={isConfirmOpen}
        title="Unenroll from course?"
        description="Your enrollment and course progress will be removed from your dashboard."
        confirmLabel={isLoading ? "Unenrolling..." : "Unenroll"}
        cancelLabel="Keep course"
        onConfirm={handleUnenroll}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </>
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
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleDownload = async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    setErrorMessage("");
    try {
      const res = await fetch(downloadUrl);
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
      logger.error("Authenticated download failed:", error);
      setErrorMessage("Download failed. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      {errorMessage ? <StatusBanner variant="error" title={errorMessage} className="mt-3 py-2 text-xs" /> : null}
      <button
        type="button"
        onClick={handleDownload}
        disabled={isDownloading}
        className={className || "btn-primary mt-3 w-full py-2 text-xs"}
      >
        {isDownloading ? "Downloading..." : label}
      </button>
    </>
  );
}

export function DownloadCertificateButton({ courseId }: { courseId: string }) {
  return (
    <AuthenticatedDownloadButton
      downloadUrl={`/api/docs/certificate/${encodeURIComponent(courseId)}`}
      label="Download Certificate"
      fallbackFilename="certificate.pdf"
    />
  );
}
