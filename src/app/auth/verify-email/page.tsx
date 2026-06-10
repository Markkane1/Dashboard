import React from "react";
import { verifyEmailToken } from "@/features/users/data/userDb";
import { Link } from "@/shared/navigation";
import { EmptyState, PageHeader, PageShell } from "@/shared/components/ui/DesignSystem";
import { ResendVerificationForm } from "@/features/auth/components/ResendVerificationForm";

interface VerifyEmailPageProps {
  searchParams: Promise<{
    token?: string;
  }>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const resolvedSearchParams = await searchParams;
  const token = resolvedSearchParams.token || "";
  const verified = token ? await verifyEmailToken(token) : false;

  return (
    <PageShell>
      <PageHeader
        title={verified ? "Email verified" : "Verification failed"}
        description={verified
          ? "Your account is active. You can now sign in."
          : "This verification link is invalid or expired."}
      />
      <EmptyState
        title={verified ? "Verification complete" : "Verification issue"}
        description={verified
          ? "You may now return to login and access your enrolled courses."
          : "The link may have expired. Enter your email address below to receive a new verification link."
        }
        actions={verified ? (
          <Link href="/auth/login" className="btn-primary">
            Go to login
          </Link>
        ) : (
          <div style={{ maxWidth: 400, margin: "0 auto", textAlign: "left" }}>
            <ResendVerificationForm />
          </div>
        )}
      />
    </PageShell>
  );
}
