"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "@/shared/navigation";
import { requestPasswordReset } from "@/features/auth/actions";
import { FormPanel, PageHeader, PageShell } from "@/shared/components/ui/DesignSystem";

const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
});

type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setIsLoading(true);
    await requestPasswordReset(data);
    setIsLoading(false);
    setIsSubmitted(true);
  };

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-md">
        <PageHeader title="Reset password" description="Request a recovery link for your account." />

        <FormPanel className="mt-6">
          {isSubmitted ? (
            <div className="space-y-4">
              <div role="alert" className="rounded-md border border-teal-200 bg-teal-50 p-3 text-sm font-semibold text-teal-700">
                If this email is registered, you will receive a reset link.
              </div>
              <button onClick={() => setIsSubmitted(false)} className="btn-secondary">
                Send another request
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <label className="block text-sm font-bold text-slate-700">
                Email address
                <input {...register("email")} type="email" placeholder="you@example.com" aria-invalid={errors.email ? "true" : "false"} className="control mt-2 w-full" />
                {errors.email && <span className="mt-1 block text-xs font-bold text-red-600">{errors.email.message}</span>}
              </label>
              <button type="submit" disabled={isLoading} className="btn-primary w-full">
                {isLoading ? "Sending request..." : "Send reset link"}
              </button>
            </form>
          )}

          <div className="mt-5 text-center text-sm font-semibold">
            <Link href="/auth/login" className="text-teal-700 hover:underline">Back to log in</Link>
          </div>
        </FormPanel>
      </div>
    </PageShell>
  );
}
