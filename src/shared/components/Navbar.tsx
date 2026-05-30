"use client";

import React, { useState } from "react";
import { Link } from "@/shared/navigation";
import { useSession, signOut } from "next-auth/react";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Navbar() {
  const { data: session, status } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAuthenticated = status === "authenticated";

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" });
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur transition-all duration-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          
          {/* Left Logo section */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-forest text-sm font-black text-white shadow-sm group-hover:scale-105 transition-transform duration-200">
                EPA
              </span>
              <div className="leading-none">
                <span className="block text-base font-black tracking-tight text-slate-950 group-hover:text-forest transition-colors duration-200">
                  EPA Elearning
                </span>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  InforMEA Clone
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Right Links */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/courses"
              className="text-sm font-bold text-slate-700 hover:text-forest transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 rounded"
            >
              Courses
            </Link>
            <Link
              href="/about"
              className="text-sm font-bold text-slate-700 hover:text-forest transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 rounded"
            >
              About
            </Link>
            <Link
              href="/contact"
              className="text-sm font-bold text-slate-700 hover:text-forest transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 rounded"
            >
              Contact us
            </Link>
            {isAuthenticated && (
              <Link
                href="/dashboard"
                className="text-sm font-bold text-slate-700 hover:text-forest transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 rounded"
              >
                Dashboard
              </Link>
            )}
          </nav>

          {/* Right Action buttons */}
          <div className="hidden md:flex items-center gap-4">
            <LanguageSwitcher />

            {status === "loading" ? (
              <div className="h-8 w-16 animate-pulse rounded bg-slate-100" />
            ) : isAuthenticated ? (
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-slate-600">
                  Hi, <span className="font-bold text-slate-800">{session?.user?.name}</span>
                </span>
                <button
                  onClick={handleLogout}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-red-600 hover:border-red-200 focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2 transition-all duration-200"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/auth/login"
                  className="text-sm font-bold text-forest hover:text-emerald-800 focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2 rounded px-3 py-2 transition-colors duration-200"
                >
                  Log in
                </Link>
                <Link
                  href="/auth/signup"
                  className="rounded-md bg-forest px-4 py-2 text-sm font-black text-white hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2 shadow-sm transition-all duration-200 hover:shadow"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <div className="flex md:hidden items-center gap-3">
            <LanguageSwitcher />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              type="button"
              aria-label="Toggle menu"
              className="inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-forest"
            >
              {isMobileMenuOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Slide-down Panel */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white shadow-lg animate-in slide-in-from-top duration-200">
          <div className="space-y-1 px-4 py-4 pb-6">
            <Link
              href="/courses"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block rounded-md px-3 py-2.5 text-base font-bold text-slate-700 hover:bg-slate-50 hover:text-forest"
            >
              Courses
            </Link>
            <Link
              href="/about"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block rounded-md px-3 py-2.5 text-base font-bold text-slate-700 hover:bg-slate-50 hover:text-forest"
            >
              About
            </Link>
            <Link
              href="/contact"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block rounded-md px-3 py-2.5 text-base font-bold text-slate-700 hover:bg-slate-50 hover:text-forest"
            >
              Contact us
            </Link>
            {isAuthenticated && (
              <Link
                href="/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block rounded-md px-3 py-2.5 text-base font-bold text-slate-700 hover:bg-slate-50 hover:text-forest"
              >
                Dashboard
              </Link>
            )}

            <div className="border-t border-slate-100 my-4 pt-4">
              {isAuthenticated ? (
                <div className="space-y-3 px-3">
                  <p className="text-sm font-semibold text-slate-500">
                    Signed in as <span className="font-bold text-slate-800">{session?.user?.name}</span>
                  </p>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full rounded-md border border-slate-300 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-red-600 hover:border-red-200 focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2 transition-colors"
                  >
                    Log out
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 px-2">
                  <Link
                    href="/auth/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex justify-center items-center rounded-md border border-slate-300 py-2.5 text-sm font-bold text-forest hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/auth/signup"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex justify-center items-center rounded-md bg-forest py-2.5 text-sm font-black text-white hover:bg-emerald-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </header>
  );
}
