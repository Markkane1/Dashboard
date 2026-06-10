import React from "react";
import { confirmEmailChange } from "@/features/auth/actions";
import { Link } from "@/shared/navigation";
import { EmptyState, PageHeader, PageShell } from "@/shared/components/ui/DesignSystem";

export const metadata = {
  title: "Confirm email change — EPA eLearning",
};

interface ConfirmEmailChangePageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ConfirmEmailChangePage({ searchParams }: ConfirmEmailChangePageProps) {
  const { token = "" } = await searchParams;
  const result = token ? await confirmEmailChange({ token }) : { success: false, error: "No confirmation token provided." };

  return (
    <PageShell>
      <PageHeader
        title={result.success ? "Email address updated" : "Confirmation failed"}
        description={result.success
          ? "Your email address has been successfully changed."
          : result.error || "This confirmation link is invalid or has expired."}
      />
      <EmptyState
        title={result.success ? "Change confirmed" : "Unable to confirm"}
        description={result.success
          ? "Your new email address is now active. Please sign in again to refresh your session."
          : "The link may have expired (links are valid for 24 hours). Please go back and request a new email change."
        }
        actions={(
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            {result.success ? (
              <Link href="/auth/login" className="btn-primary">
                Sign in
              </Link>
            ) : (
              <>
                <Link href="/auth/change-email" className="btn-primary">
                  Try again
                </Link>
                <Link href="/dashboard" className="btn-secondary">
                  Back to dashboard
                </Link>
              </>
            )}
          </div>
        )}
      />
    </PageShell>
  );
}
