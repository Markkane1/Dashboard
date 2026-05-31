"use client";

import React, { useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Link } from "@/shared/navigation";
import { loginSchema, LoginInput } from "@/features/auth/validations";
import { logger } from '@/shared/logger';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    setGlobalError(null);

    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setGlobalError("The email address or password you entered is incorrect.");
      } else {
        router.refresh();
        router.push(callbackUrl);
      }
    } catch (error) {
      logger.error("Login unexpected error:", error);
      setGlobalError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl });
  };

  return (
    <section className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="text-center">
          <span className="inline-grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-xl font-bold text-forest">
            🔑
          </span>
          <h1 className="mt-4 text-3xl font-black text-slate-950">Log in</h1>
          <p className="mt-2 text-sm text-slate-500">
            Access your EPA environmental catalog courses
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

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
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
              placeholder="••••••••"
              aria-invalid={errors.password ? "true" : "false"}
              className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm text-slate-900 focus:border-forest focus:ring-1 focus:ring-forest outline-none transition-colors ${
                errors.password ? "border-red-400 focus:border-red-400 focus:ring-red-400" : "border-slate-300"
              }`}
            />
            {errors.password && (
              <span className="mt-1 block text-xs font-bold text-red-600">{errors.password.message}</span>
            )}
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full rounded-md bg-forest py-2.5 text-sm font-black text-white hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6 flex items-center justify-center text-xs font-bold uppercase tracking-wider text-slate-400">
          <div className="absolute inset-0 border-t border-slate-200" />
          <span className="relative bg-white px-3">or continue with</span>
        </div>

        {/* Google sign-in */}
        <button
          onClick={handleGoogleSignIn}
          type="button"
          className="w-full flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5.04c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 1.76 14.94 1 12 1 7.35 1 3.4 3.65 1.5 7.5l3.6 2.8C6.01 7.15 8.78 5.04 12 5.04z"
            />
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.28 1.48-1.12 2.74-2.38 3.58l3.69 2.86c2.16-1.99 3.41-4.92 3.41-8.59z"
            />
            <path
              fill="#FBBC05"
              d="M5.1 14.7c-.24-.72-.38-1.49-.38-2.3s.14-1.58.38-2.3L1.5 7.3C.54 9.21 0 11.35 0 13.6s.54 4.39 1.5 6.3l3.6-2.9-1-.3z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.69-2.86c-1.02.68-2.33 1.09-3.96 1.09-3.22 0-5.99-2.11-6.9-5.26l-3.6 2.8C3.4 20.35 7.35 23 12 23z"
            />
          </svg>
          Sign in with Google
        </button>

        {/* Links */}
        <div className="mt-8 space-y-3 text-center text-sm font-semibold">
          <div>
            <span className="text-slate-500">New to the platform? </span>
            <Link href="/auth/signup" className="text-forest hover:underline">
              Create your account
            </Link>
          </div>
          <div>
            <Link href="/auth/forgot-password" className="text-forest hover:underline text-xs">
              Forgotten your username or password?
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-forest" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
