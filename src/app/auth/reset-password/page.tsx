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
            <div className="rounded border border-[#1cc88a] bg-[#e8fbf4] p-4 text-sm font-bold text-[#1cc88a]">
              Password updated. You can now sign in.
            </div>
            <Link href="/auth/login" className="bg-[#4e73df] hover:bg-[#2e59d9] text-white font-bold py-2 px-4 rounded w-full text-center block transition-colors text-sm">
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div role="alert" className="rounded border border-[#e74a3b] bg-[#fce4e4] p-3 text-sm font-bold text-[#e74a3b]">
                {error}
              </div>
            )}

            <label className="block text-sm font-bold text-[#858796]">
              New password
              <input {...register("password")} type="password" className="w-full mt-2 bg-white border border-[#e3e6f0] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#bac8f3] focus:ring-0 transition-colors" />
              {errors.password && <span className="mt-1 block text-xs font-bold text-[#e74a3b]">{errors.password.message}</span>}
            </label>

            <label className="block text-sm font-bold text-[#858796]">
              Confirm password
              <input {...register("confirmPassword")} type="password" className="w-full mt-2 bg-white border border-[#e3e6f0] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#bac8f3] focus:ring-0 transition-colors" />
              {errors.confirmPassword && <span className="mt-1 block text-xs font-bold text-[#e74a3b]">{errors.confirmPassword.message}</span>}
            </label>

            <button type="submit" disabled={isLoading || !token} className="bg-[#4e73df] hover:bg-[#2e59d9] text-white font-bold py-2 px-4 rounded w-full transition-colors text-sm">
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
