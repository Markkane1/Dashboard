import React from "react";
import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import { ChangeEmailForm } from "@/features/auth/components/ChangeEmailForm";
import { PageHeader, PageShell } from "@/shared/components/ui/DesignSystem";

export const metadata = {
  title: "Change email address — EPA eLearning",
  description: "Update the email address associated with your EPA eLearning account.",
};

export default async function ChangeEmailPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/login?callbackUrl=/auth/change-email");
  }

  return (
    <PageShell>
      <PageHeader
        title="Change email address"
        description="Enter a new email address. We will send a confirmation link to the new address."
      />
      <div style={{ maxWidth: 440, margin: "0 auto" }}>
        <ChangeEmailForm currentEmail={session.user.email ?? ""} />
      </div>
    </PageShell>
  );
}
