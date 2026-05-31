"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "@/shared/navigation";
import { requestPasswordReset } from "@/features/auth/actions";

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
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setIsLoading(true);
    await requestPasswordReset(data);
    setIsLoading(false);
    setIsSubmitted(true);
  };

  return (
    <section className="mx-auto max-w-md px-4 py-16">
      <div className="glass-card p-8 border-white/20 bg-white/50 backdrop-blur-sm">
        <div className="text-center">
          <span className="inline-grid h-12 w-12 place-items-center rounded-full bg-[#b0f0d6]/40 text-xl font-bold text-forest">
            📧
          </span>
          <h1 className="mt-4 text-3xl font-black text-slate-950 font-sora">Reset password</h1>
          <p className="mt-2 text-sm text-slate-655 font-semibold">
            Get recovery details for your environmental study profile
          </p>
        </div>

        {isSubmitted ? (
          <div className="mt-8 space-y-4 text-center">
            <div
              role="alert"
              className="rounded-2xl bg-[#b0f0d6]/20 border border-[#95d3ba]/30 p-4 text-sm font-semibold text-emerald-800"
            >
              ✅ If this email is registered, you will receive a reset link.
            </div>
            <p className="text-xs text-slate-500 leading-relaxed font-semibold">
              Please check your spam or junk folder if the link does not appear in your inbox within a few minutes.
            </p>
            <button
              onClick={() => setIsSubmitted(false)}
              className="mt-2 text-sm font-bold text-forest hover:underline"
            >
              Send another request
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <label className="block text-sm font-bold text-slate-700">
              Email address
              <input
                {...register("email")}
                type="email"
                placeholder="you@example.com"
                aria-invalid={errors.email ? "true" : "false"}
                className={`mt-1.5 w-full rounded-full border px-4 py-2.5 text-sm text-slate-900 focus:border-forest focus:ring-2 focus:ring-forest/20 outline-none transition-all ${
                  errors.email ? "border-red-400 focus:border-red-400 focus:ring-red-400" : "border-white/30 bg-white/60"
                }`}
              />
              {errors.email && (
                <span className="mt-1 block text-xs font-bold text-red-650 px-2">{errors.email.message}</span>
              )}
            </label>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full rounded-full bg-forest py-2.5 text-sm font-black text-white hover:bg-[#b0f0d6] hover:text-[#003527] focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-forest/10 hover:scale-[1.01]"
            >
              {isLoading ? "Sending request..." : "Send reset link"}
            </button>
          </form>
        )}

        <div className="mt-8 text-center text-sm font-semibold">
          <Link href="/auth/login" className="text-forest hover:underline">
            Back to log in
          </Link>
        </div>
      </div>
    </section>
  );
}
