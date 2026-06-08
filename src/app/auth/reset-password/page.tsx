"use client";

import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { resetPassword } from "@/features/auth/actions";
import { Link } from "@/shared/navigation";
import { FormPanel, PageHeader, PageShell } from "@/shared/components/ui/DesignSystem";

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

function ResetPasswordForm() {
  const token = useSearchParams().get("token") || "";
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ResetPasswordInput) => {
    setIsLoading(true);
    setError(null);
    const result = await resetPassword({ token, ...data });
    setIsLoading(false);
    if (!result.success) {
      setError(result.error || "Unable to reset password.");
      return;
    }
    setSuccess(true);
  };

  return (
    <PageShell>
      <PageHeader
        title="Choose a new password"
        description="Reset links expire after one hour. Use a strong password to keep your account secure."
      />

      <FormPanel className="max-w-md">
        {success ? (
          <div className="space-y-4">
            <div className="rounded-md border border-teal-200 bg-teal-50 p-4 text-sm font-semibold text-teal-700">
              Password updated. You can now sign in.
            </div>
            <Link href="/auth/login" className="btn-primary w-full">
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            <label className="block text-sm font-bold text-slate-700">
              New password
              <input {...register("password")} type="password" className="control mt-2 w-full" />
              {errors.password && <span className="mt-1 block text-xs font-bold text-red-600">{errors.password.message}</span>}
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Confirm password
              <input {...register("confirmPassword")} type="password" className="control mt-2 w-full" />
              {errors.confirmPassword && <span className="mt-1 block text-xs font-bold text-red-600">{errors.confirmPassword.message}</span>}
            </label>

            <button type="submit" disabled={isLoading || !token} className="btn-primary w-full">
              {isLoading ? "Updating..." : "Reset password"}
            </button>
          </form>
        )}
      </FormPanel>
    </PageShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-sm font-semibold text-slate-500">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
