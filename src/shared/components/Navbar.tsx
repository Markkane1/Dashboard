"use client";

import React, { useEffect, useRef, useState } from "react";
import { Link } from "@/shared/navigation";
import { useSession, signOut } from "next-auth/react";
import { hasPermission, PERMISSIONS } from '@/shared/permissions';
import LanguageSwitcher from "./LanguageSwitcher";

export default function Navbar() {
  const { data: session, status } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const isAuthenticated = status === "authenticated";
  const canManageContent = hasPermission(session?.user, PERMISSIONS.MANAGE_CONTENT);
  const isAdmin = hasPermission(session?.user, PERMISSIONS.MANAGE_USERS);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const firstFocusable = mobileMenuRef.current?.querySelector<HTMLElement>("a, button");
    firstFocusable?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMobileMenuOpen]);

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" });
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/35 bg-white/80 shadow-sm backdrop-blur-xl transition-all duration-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-16 items-center justify-between gap-3 py-2">
          
          {/* Left Logo section */}
          <div className="flex-shrink-0">
            <Link href="/" className="group flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-forest text-sm font-black text-white shadow-sm transition-transform duration-200 group-hover:scale-105">
                EPA
              </span>
              <div className="min-w-0 leading-none max-w-[10rem] sm:max-w-none">
                <span className="block truncate text-base font-black tracking-tight text-brand-on-surface transition-colors duration-200 group-hover:text-forest">
                  EPA Elearning
                </span>
                <span className="hidden text-[10px] font-bold uppercase tracking-wider text-brand-on-surface-variant sm:block">
                  Environmental Learning Platform
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Right Links */}
          <nav className="hidden items-center gap-1 lg:flex">
            <Link
              href="/courses"
              className="rounded-full px-3.5 py-2 text-sm font-bold text-brand-on-surface-variant transition-colors duration-200 hover:bg-brand-secondary-container/50 hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
            >
              Courses
            </Link>
            <Link
              href="/about"
              className="rounded-full px-3.5 py-2 text-sm font-bold text-brand-on-surface-variant transition-colors duration-200 hover:bg-brand-secondary-container/50 hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
            >
              About
            </Link>
            <Link
              href="/contact"
              className="rounded-full px-3.5 py-2 text-sm font-bold text-brand-on-surface-variant transition-colors duration-200 hover:bg-brand-secondary-container/50 hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
            >
              Contact us
            </Link>
            {isAuthenticated && (
              <>
                <Link
                  href="/dashboard"
                  className="rounded-full px-3.5 py-2 text-sm font-bold text-brand-on-surface-variant transition-colors duration-200 hover:bg-brand-secondary-container/50 hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
                >
                  Dashboard
                </Link>
                <Link
                  href="/notifications"
                  className="rounded-full px-3.5 py-2 text-sm font-bold text-brand-on-surface-variant transition-colors duration-200 hover:bg-brand-secondary-container/50 hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
                >
                  Notifications
                </Link>
                {canManageContent && (
                  <>
                    <Link
                      href="/instructor/content"
                      className="rounded-full px-3.5 py-2 text-sm font-bold text-brand-on-surface-variant transition-colors duration-200 hover:bg-brand-secondary-container/50 hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
                    >
                      Instructor
                    </Link>
                    <Link
                      href="/instructor/analytics"
                      className="rounded-full px-3.5 py-2 text-sm font-bold text-brand-on-surface-variant transition-colors duration-200 hover:bg-brand-secondary-container/50 hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
                    >
                      Analytics
                    </Link>
                  </>
                )}
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="rounded-full px-3.5 py-2 text-sm font-bold text-brand-on-surface-variant transition-colors duration-200 hover:bg-brand-secondary-container/50 hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
                  >
                    Admin
                  </Link>
                )}
              </>
            )}
          </nav>

          {/* Right Action buttons */}
          <div className="hidden items-center gap-3 md:flex">
            <LanguageSwitcher />

            {status === "loading" ? (
              <div className="h-8 w-16 animate-pulse rounded bg-slate-100" />
            ) : isAuthenticated ? (
              <div className="flex items-center gap-3">
                <span className="hidden max-w-40 truncate text-sm font-semibold text-brand-on-surface-variant xl:block">
                  Hi, <span className="font-bold text-brand-on-surface">{session?.user?.name}</span>
                </span>
                <button
                  onClick={handleLogout}
                  className="rounded-full border border-white/40 bg-white/45 px-4 py-2 text-sm font-bold text-brand-on-surface-variant transition-all duration-200 hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/auth/login"
                className="rounded-full px-4 py-2 text-sm font-bold text-forest transition-colors duration-200 hover:bg-brand-secondary-container/50 hover:text-brand-secondary focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2"
                >
                  Log in
                </Link>
                <Link
                  href="/auth/signup"
                  className="rounded-full bg-forest px-5 py-2 text-sm font-black text-white shadow-sm transition-all duration-200 hover:bg-[#b0f0d6] hover:text-[#003527] hover:shadow focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <div className="min-w-0 flex items-center gap-2 lg:hidden">
            <LanguageSwitcher />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              type="button"
              aria-label="Toggle menu"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-navigation"
              className="inline-flex items-center justify-center rounded-full bg-white/45 p-2 text-brand-on-surface-variant hover:bg-brand-secondary-container/50 hover:text-forest focus:outline-none focus:ring-2 focus:ring-inset focus:ring-forest"
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
        <div
          id="mobile-navigation"
          ref={mobileMenuRef}
          role="navigation"
          aria-label="Mobile menu"
          className="border-t border-white/30 bg-white/90 shadow-lg backdrop-blur-xl animate-in slide-in-from-top duration-200 lg:hidden"
        >
          <div className="space-y-1 px-4 py-4 pb-6">
            <Link
              href="/courses"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block rounded-full px-4 py-2.5 text-base font-bold text-slate-700 hover:bg-white/60 hover:text-forest"
            >
              Courses
            </Link>
            <Link
              href="/about"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block rounded-full px-4 py-2.5 text-base font-bold text-slate-700 hover:bg-white/60 hover:text-forest"
            >
              About
            </Link>
            <Link
              href="/contact"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block rounded-full px-4 py-2.5 text-base font-bold text-slate-700 hover:bg-white/60 hover:text-forest"
            >
              Contact us
            </Link>
            {isAuthenticated && (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block rounded-full px-4 py-2.5 text-base font-bold text-slate-700 hover:bg-white/60 hover:text-forest"
                >
                  Dashboard
                </Link>
                <Link
                  href="/notifications"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block rounded-full px-4 py-2.5 text-base font-bold text-slate-700 hover:bg-white/60 hover:text-forest"
                >
                  Notifications
                </Link>
                {canManageContent && (
                  <>
                    <Link
                      href="/instructor/content"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block rounded-full px-4 py-2.5 text-base font-bold text-slate-700 hover:bg-white/60 hover:text-forest"
                    >
                      Instructor
                    </Link>
                    <Link
                      href="/instructor/analytics"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block rounded-full px-4 py-2.5 text-base font-bold text-slate-700 hover:bg-white/60 hover:text-forest"
                    >
                      Analytics
                    </Link>
                  </>
                )}
                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block rounded-full px-4 py-2.5 text-base font-bold text-slate-700 hover:bg-white/60 hover:text-forest"
                  >
                    Admin
                  </Link>
                )}
              </>
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
                    className="w-full rounded-full border border-slate-300 py-2.5 text-sm font-bold text-slate-700 hover:bg-white/60 hover:text-red-600 hover:border-red-200 focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2 transition-colors"
                  >
                    Log out
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 px-2 min-[420px]:grid-cols-2">
                  <Link
                    href="/auth/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex justify-center items-center rounded-full border border-slate-300 py-2.5 text-sm font-bold text-forest hover:bg-white/60 focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/auth/signup"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex justify-center items-center rounded-full bg-forest py-2.5 text-sm font-black text-white hover:bg-[#b0f0d6] hover:text-[#003527] shadow-sm focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2"
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
