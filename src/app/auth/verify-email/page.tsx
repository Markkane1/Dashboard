import React from "react";
import { verifyEmailToken } from "@/features/users/data/userDb";
import { Link } from "@/shared/navigation";
import { EmptyState, PageHeader, PageShell } from "@/shared/components/ui/DesignSystem";

interface VerifyEmailPageProps {
  searchParams: {
    token?: string;
  };
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const token = searchParams.token || "";
  const verified = token ? await verifyEmailToken(token) : false;

  return (
    <PageShell>
      <PageHeader
        title={verified ? "Email verified" : "Verification failed"}
        description={verified
          ? "Your account is active. You can now sign in."
          : "This verification link is invalid or expired. Please create a new account or contact support."}
      />
      <EmptyState
        title={verified ? "Verification complete" : "Verification issue"}
        description={verified
          ? "You may now return to login and access your enrolled courses."
          : "If the link has expired, request a new verification email or contact support."
        }
        actions={(
          <Link href="/auth/login" className="btn-primary">
            Go to login
          </Link>
        )}
      />
    </PageShell>
  );
}
