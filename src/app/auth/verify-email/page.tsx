import React from "react";
import { verifyEmailToken } from "@/features/users/data/userDb";
import { Link } from "@/shared/navigation";

interface VerifyEmailPageProps {
  searchParams: {
    token?: string;
  };
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const token = searchParams.token || "";
  const verified = token ? await verifyEmailToken(token) : false;

  return (
    <section className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <h1 className="text-3xl font-black text-slate-950">
          {verified ? "Email verified" : "Verification failed"}
        </h1>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">
          {verified
            ? "Your account is active. You can now sign in."
            : "This verification link is invalid or expired. Please create a new account or contact support."}
        </p>
        <Link
          href="/auth/login"
          className="mt-6 inline-flex rounded-md bg-forest px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-800"
        >
          Go to login
        </Link>
      </div>
    </section>
  );
}
