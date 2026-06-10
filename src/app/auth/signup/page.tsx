"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Script from "next/script";
import { Link } from "@/shared/navigation";
import { registerUser } from "@/features/auth/actions";
import { signupSchema, SignupInput } from "@/features/auth/validations";
import { logger } from "@/shared/logger";
import { FormPanel, PageHeader, PageShell } from "@/shared/components/ui/DesignSystem";

export default function SignupPage() {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      captchaToken: "",
    },
  });

  React.useEffect(() => {
    if (!turnstileSiteKey) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).onSignupCaptchaSuccess = (token: string) => {
      setValue("captchaToken", token, { shouldValidate: true });
    };

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).onSignupCaptchaSuccess;
    };
  }, [setValue, turnstileSiteKey]);

  const onSubmit = async (data: SignupInput) => {
    setIsLoading(true);
    setGlobalError(null);
    setSuccessMessage(null);

    try {
      const response = await registerUser(data);

      if (!response.success) {
        setGlobalError(response.error || "An error occurred during sign up.");
        setIsLoading(false);
        return;
      }

      setSuccessMessage(response.message || "Account created. Check your email to verify your account.");
      setIsLoading(false);
    } catch (error) {
      logger.error("Sign up unexpected error:", error);
      setGlobalError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-md">
        <PageHeader title="Create account" description="Enroll in courses and track certificates." />

        <FormPanel className="mt-6">
          {globalError && (
            <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {globalError}
            </div>
          )}

          {successMessage && (
            <div role="alert" className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-3 text-sm font-semibold text-teal-700">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
          <label className="block text-sm font-bold text-slate-700">
            Full name
            <input {...register("name")} type="text" placeholder="John Doe" aria-invalid={errors.name ? "true" : "false"} className="control mt-2 w-full" />
            {errors.name && <span className="mt-1 block text-xs font-bold text-red-600">{errors.name.message}</span>}
          </label>

          <label className="block text-sm font-bold text-slate-700">
            Email address
            <input {...register("email")} type="email" placeholder="you@example.com" aria-invalid={errors.email ? "true" : "false"} className="control mt-2 w-full" />
            {errors.email && <span className="mt-1 block text-xs font-bold text-red-600">{errors.email.message}</span>}
          </label>

          <label className="block text-sm font-bold text-slate-700">
            Password
            <input {...register("password")} type="password" placeholder="Minimum 8 characters" aria-invalid={errors.password ? "true" : "false"} className="control mt-2 w-full" />
            {errors.password && <span className="mt-1 block text-xs font-bold text-red-600">{errors.password.message}</span>}
          </label>

          <label className="block text-sm font-bold text-slate-700">
            Confirm password
            <input {...register("confirmPassword")} type="password" placeholder="Verify password matches" aria-invalid={errors.confirmPassword ? "true" : "false"} className="control mt-2 w-full" />
            {errors.confirmPassword && <span className="mt-1 block text-xs font-bold text-red-600">{errors.confirmPassword.message}</span>}
          </label>

          <input type="hidden" {...register("captchaToken")} />
          {turnstileSiteKey && (
            <>
              <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
              <div className="cf-turnstile" data-sitekey={turnstileSiteKey} data-callback="onSignupCaptchaSuccess" />
            </>
          )}

          <button type="submit" disabled={isLoading} className="btn-primary w-full">
            {isLoading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm font-semibold text-slate-600">
          Already registered? <Link href="/auth/login" className="text-teal-700 hover:underline">Log in</Link>
        </p>
      </FormPanel>
    </div>
  </PageShell>
  );
}
