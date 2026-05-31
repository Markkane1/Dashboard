"use client";

import React, { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { resetPassword } from "@/features/auth/actions";
import { Link } from "@/shared/navigation";

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

export default function ResetPasswordPage() {
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
    <section className="mx-auto max-w-md px-4 py-16">
      <div className="glass-card p-8 border-white/20 bg-white/50 backdrop-blur-sm">
        <div className="text-center">
          <span className="inline-grid h-12 w-12 place-items-center rounded-full bg-[#b0f0d6]/40 text-xl font-bold text-forest mb-4">
            🔑
          </span>
          <h1 className="text-3xl font-black text-slate-950 font-sora">Choose a new password</h1>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            Reset links expire after one hour.
          </p>
        </div>

        {success ? (
          <div className="mt-8 text-center">
            <div className="rounded-2xl border border-emerald-255/30 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
              Password updated. You can now sign in.
            </div>
            <Link href="/auth/login" className="mt-5 inline-flex text-sm font-bold text-forest hover:underline">
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            {error && (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            <label className="block text-sm font-bold text-slate-700">
              New password
              <input
                {...register("password")}
                type="password"
                className={`mt-1.5 w-full rounded-full border px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-forest focus:ring-2 focus:ring-forest/20 transition-all ${
                  errors.password ? "border-red-400 focus:border-red-400" : "border-white/30 bg-white/60"
                }`}
              />
              {errors.password && (
                <span className="mt-1 block text-xs font-bold text-red-600 px-2">{errors.password.message}</span>
              )}
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Confirm password
              <input
                {...register("confirmPassword")}
                type="password"
                className={`mt-1.5 w-full rounded-full border px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-forest focus:ring-2 focus:ring-forest/20 transition-all ${
                  errors.confirmPassword ? "border-red-400 focus:border-red-400" : "border-white/30 bg-white/60"
                }`}
              />
              {errors.confirmPassword && (
                <span className="mt-1 block text-xs font-bold text-red-650 px-2">{errors.confirmPassword.message}</span>
              )}
            </label>

            <button
              type="submit"
              disabled={isLoading || !token}
              className="w-full rounded-full bg-forest py-2.5 text-sm font-black text-white hover:bg-[#b0f0d6] hover:text-[#003527] disabled:cursor-not-allowed disabled:opacity-50 transition-all shadow-md shadow-forest/10 hover:scale-[1.01]"
            >
              {isLoading ? "Updating..." : "Reset password"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
