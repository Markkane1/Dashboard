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
  const callbackUrlParam = searchParams.get("callbackUrl") || searchParams.get("redirect") || searchParams.get("returnTo") || "/dashboard";
  const callbackUrl = (callbackUrlParam.startsWith("/") && !callbackUrlParam.startsWith("//")) ? callbackUrlParam : "/dashboard";
  const errorParam = searchParams.get("error");

  const getErrorMessage = () => {
    if (globalError) return globalError;
    if (errorParam === "PendingApproval") return "Your account is pending administrator approval.";
    if (errorParam === "AccountDisabled") return "Your account has been disabled.";
    if (errorParam === "AccessDenied") return "Access denied. You do not have permission to log in.";
    if (errorParam) return "An error occurred during authentication. Please try again.";
    return null;
  };
  const activeError = getErrorMessage();

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
          {activeError && (
            <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {activeError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
          <label className="block text-sm font-bold text-[#858796]">
            Email address
            <input {...register("email")} type="email" placeholder="you@example.com" aria-invalid={errors.email ? "true" : "false"} className="w-full mt-2 bg-white border border-[#e3e6f0] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#bac8f3] focus:ring-0 transition-colors" />
            {errors.email && <span className="mt-1 block text-xs font-bold text-[#e74a3b]">{errors.email.message}</span>}
          </label>

          <label className="block text-sm font-bold text-[#858796]">
            Password
            <input {...register("password")} type="password" placeholder="Enter your password" aria-invalid={errors.password ? "true" : "false"} className="w-full mt-2 bg-white border border-[#e3e6f0] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#bac8f3] focus:ring-0 transition-colors" />
            {errors.password && <span className="mt-1 block text-xs font-bold text-[#e74a3b]">{errors.password.message}</span>}
          </label>

          <button type="submit" disabled={isLoading} className="bg-[#4e73df] hover:bg-[#2e59d9] text-white font-bold py-2 px-4 rounded w-full transition-colors text-sm">
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="my-5 border-t border-[#e3e6f0]" />

        <button onClick={handleGoogleSignIn} type="button" className="bg-[#ea4335] hover:bg-[#c53727] text-white font-bold py-2 px-4 rounded w-full transition-colors text-sm flex items-center justify-center gap-2">
          <i className="fab fa-google fa-fw"></i> Sign in with Google
        </button>

        <div className="mt-5 space-y-2 text-center text-sm font-bold">
          <p className="text-[#858796]">
            New to the platform? <Link href="/auth/signup" className="text-[#4e73df] hover:text-[#2e59d9] hover:underline">Create an account!</Link>
          </p>
          <Link href="/auth/forgot-password" className="text-xs text-[#4e73df] hover:text-[#2e59d9] hover:underline">
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
