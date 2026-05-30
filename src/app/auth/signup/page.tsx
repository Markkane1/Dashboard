"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Script from "next/script";
import { Link } from "@/shared/navigation";
import { registerUser } from "@/features/auth/actions";
import { signupSchema, SignupInput } from "@/features/auth/validations";

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

    (window as any).onSignupCaptchaSuccess = (token: string) => {
      setValue("captchaToken", token, { shouldValidate: true });
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
      console.error("Sign up unexpected error:", error);
      setGlobalError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="text-center">
          <span className="inline-grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-xl font-bold text-forest">
            🌱
          </span>
          <h1 className="mt-4 text-3xl font-black text-slate-950">Create account</h1>
          <p className="mt-2 text-sm text-slate-500">
            Sign up to enroll in environmental courses and earn certificates
          </p>
        </div>

        {globalError && (
          <div
            role="alert"
            className="mt-6 rounded-lg bg-red-50 border border-red-200 p-4 text-sm font-semibold text-red-700"
          >
            ⚠️ {globalError}
          </div>
        )}

        {successMessage && (
          <div
            role="alert"
            className="mt-6 rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm font-semibold text-emerald-800"
          >
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <label className="block text-sm font-bold text-slate-700">
            Full name
            <input
              {...register("name")}
              type="text"
              placeholder="John Doe"
              aria-invalid={errors.name ? "true" : "false"}
              className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm text-slate-900 focus:border-forest focus:ring-1 focus:ring-forest outline-none transition-colors ${
                errors.name ? "border-red-400 focus:border-red-400 focus:ring-red-400" : "border-slate-300"
              }`}
            />
            {errors.name && (
              <span className="mt-1 block text-xs font-bold text-red-600">{errors.name.message}</span>
            )}
          </label>

          <label className="block text-sm font-bold text-slate-700">
            Email address
            <input
              {...register("email")}
              type="email"
              placeholder="you@example.com"
              aria-invalid={errors.email ? "true" : "false"}
              className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm text-slate-900 focus:border-forest focus:ring-1 focus:ring-forest outline-none transition-colors ${
                errors.email ? "border-red-400 focus:border-red-400 focus:ring-red-400" : "border-slate-300"
              }`}
            />
            {errors.email && (
              <span className="mt-1 block text-xs font-bold text-red-600">{errors.email.message}</span>
            )}
          </label>

          <label className="block text-sm font-bold text-slate-700">
            Password
            <input
              {...register("password")}
              type="password"
              placeholder="Minimum 8 characters"
              aria-invalid={errors.password ? "true" : "false"}
              className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm text-slate-900 focus:border-forest focus:ring-1 focus:ring-forest outline-none transition-colors ${
                errors.password ? "border-red-400 focus:border-red-400 focus:ring-red-400" : "border-slate-300"
              }`}
            />
            {errors.password && (
              <span className="mt-1 block text-xs font-bold text-red-600">{errors.password.message}</span>
            )}
          </label>

          <label className="block text-sm font-bold text-slate-700">
            Confirm password
            <input
              {...register("confirmPassword")}
              type="password"
              placeholder="Verify password matches"
              aria-invalid={errors.confirmPassword ? "true" : "false"}
              className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm text-slate-900 focus:border-forest focus:ring-1 focus:ring-forest outline-none transition-colors ${
                errors.confirmPassword ? "border-red-400 focus:border-red-400 focus:ring-red-400" : "border-slate-300"
              }`}
            />
            {errors.confirmPassword && (
              <span className="mt-1 block text-xs font-bold text-red-600">{errors.confirmPassword.message}</span>
            )}
          </label>

          <input type="hidden" {...register("captchaToken")} />
          {turnstileSiteKey && (
            <>
              <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
              <div
                className="cf-turnstile"
                data-sitekey={turnstileSiteKey}
                data-callback="onSignupCaptchaSuccess"
              />
            </>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-4 w-full rounded-md bg-forest py-2.5 text-sm font-black text-white hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isLoading ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <div className="mt-8 text-center text-sm font-semibold">
          <span className="text-slate-500">Already registered? </span>
          <Link href="/auth/login" className="text-forest hover:underline">
            Log in
          </Link>
        </div>
      </div>
    </section>
  );
}
