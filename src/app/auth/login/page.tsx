"use client";

import React, { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Link } from "@/shared/navigation";
import { loginSchema, LoginInput } from "@/features/auth/validations";
import { logger } from "@/shared/logger";
import { FormPanel, PageHeader, PageShell } from "@/shared/components/ui/DesignSystem";

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
    <PageShell>
      <div className="mx-auto w-full max-w-md">
        <PageHeader title="Log in" description="Access your courses and certificates." />

        <FormPanel className="mt-6">
          {globalError && (
            <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {globalError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
          <label className="block text-sm font-bold text-slate-700">
            Email address
            <input {...register("email")} type="email" placeholder="you@example.com" aria-invalid={errors.email ? "true" : "false"} className="control mt-2 w-full" />
            {errors.email && <span className="mt-1 block text-xs font-bold text-red-600">{errors.email.message}</span>}
          </label>

          <label className="block text-sm font-bold text-slate-700">
            Password
            <input {...register("password")} type="password" placeholder="Enter your password" aria-invalid={errors.password ? "true" : "false"} className="control mt-2 w-full" />
            {errors.password && <span className="mt-1 block text-xs font-bold text-red-600">{errors.password.message}</span>}
          </label>

          <button type="submit" disabled={isLoading} className="btn-primary w-full">
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="my-5 border-t border-slate-200" />

        <button onClick={handleGoogleSignIn} type="button" className="btn-secondary w-full">
          Sign in with Google
        </button>

        <div className="mt-5 space-y-2 text-center text-sm font-semibold">
          <p className="text-slate-600">
            New to the platform? <Link href="/auth/signup" className="text-teal-700 hover:underline">Create an account</Link>
          </p>
          <Link href="/auth/forgot-password" className="text-xs text-teal-700 hover:underline">
            Forgotten your username or password?
          </Link>
        </div>
      </FormPanel>
    </div>
  </PageShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="dashboard-page text-sm font-semibold text-slate-500">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
