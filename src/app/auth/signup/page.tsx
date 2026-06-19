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
          <label className="block text-sm font-bold text-[#858796]">
            Full name
            <input {...register("name")} type="text" placeholder="John Doe" aria-invalid={errors.name ? "true" : "false"} className="w-full mt-2 bg-white border border-[#e3e6f0] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#bac8f3] focus:ring-0 transition-colors" />
            {errors.name && <span className="mt-1 block text-xs font-bold text-[#e74a3b]">{errors.name.message}</span>}
          </label>

          <label className="block text-sm font-bold text-[#858796]">
            Email address
            <input {...register("email")} type="email" placeholder="you@example.com" aria-invalid={errors.email ? "true" : "false"} className="w-full mt-2 bg-white border border-[#e3e6f0] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#bac8f3] focus:ring-0 transition-colors" />
            {errors.email && <span className="mt-1 block text-xs font-bold text-[#e74a3b]">{errors.email.message}</span>}
          </label>

          <label className="block text-sm font-bold text-[#858796]">
            Password
            <input {...register("password")} type="password" placeholder="Minimum 8 characters" aria-invalid={errors.password ? "true" : "false"} className="w-full mt-2 bg-white border border-[#e3e6f0] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#bac8f3] focus:ring-0 transition-colors" />
            {errors.password && <span className="mt-1 block text-xs font-bold text-[#e74a3b]">{errors.password.message}</span>}
          </label>

          <label className="block text-sm font-bold text-[#858796]">
            Confirm password
            <input {...register("confirmPassword")} type="password" placeholder="Verify password matches" aria-invalid={errors.confirmPassword ? "true" : "false"} className="w-full mt-2 bg-white border border-[#e3e6f0] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#bac8f3] focus:ring-0 transition-colors" />
            {errors.confirmPassword && <span className="mt-1 block text-xs font-bold text-[#e74a3b]">{errors.confirmPassword.message}</span>}
          </label>

          <input type="hidden" {...register("captchaToken")} />
          {turnstileSiteKey && (
            <>
              <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
              <div className="cf-turnstile" data-sitekey={turnstileSiteKey} data-callback="onSignupCaptchaSuccess" />
            </>
          )}

          <button type="submit" disabled={isLoading} className="bg-[#4e73df] hover:bg-[#2e59d9] text-white font-bold py-2 px-4 rounded w-full transition-colors text-sm">
            {isLoading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm font-bold text-[#858796]">
          Already registered? <Link href="/auth/login" className="text-[#4e73df] hover:text-[#2e59d9] hover:underline">Log in</Link>
        </p>
      </FormPanel>
    </div>
  </PageShell>
  );
}
