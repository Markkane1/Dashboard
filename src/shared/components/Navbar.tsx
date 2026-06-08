"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/shared/navigation";
import { signOut, useSession } from "next-auth/react";
import { hasPermission, PERMISSIONS } from "@/shared/permissions";
import LanguageSwitcher from "./LanguageSwitcher";

type NavItem = {
  href: string;
  label: string;
  show: boolean;
};

export default function Navbar() {
  const { data: session, status } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const isAuthenticated = status === "authenticated";
  const canManageContent = hasPermission(session?.user, PERMISSIONS.MANAGE_CONTENT);
  const isAdmin = hasPermission(session?.user, PERMISSIONS.MANAGE_USERS);

  const navItems = useMemo<NavItem[]>(() => [
    { href: "/dashboard", label: "Dashboard", show: isAuthenticated },
    { href: "/courses", label: "Courses", show: true },
    { href: "/notifications", label: "Notifications", show: isAuthenticated },
    { href: "/instructor/content", label: "Content", show: isAuthenticated && canManageContent },
    { href: "/instructor/analytics", label: "Analytics", show: isAuthenticated && canManageContent },
    { href: "/admin", label: "Admin", show: isAuthenticated && isAdmin },
  ], [canManageContent, isAdmin, isAuthenticated]);

  const visibleNavItems = navItems.filter((item) => item.show);

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
    <header className="app-topbar">
      <div className="app-shell">
        <div className="flex min-h-14 items-center justify-between gap-4">
          <Link href={isAuthenticated ? "/dashboard" : "/"} className="flex min-w-0 items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-teal-700 text-xs font-black text-white">
              EPA
            </span>
            <span className="truncate text-sm font-black text-slate-950 sm:text-base">EPA Elearning</span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
            {visibleNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <LanguageSwitcher />
            {status === "loading" ? (
              <div className="h-8 w-24 animate-pulse rounded-md bg-slate-100" />
            ) : isAuthenticated ? (
              <>
                <span className="max-w-36 truncate text-sm font-semibold text-slate-600">
                  {session?.user?.name}
                </span>
                <button onClick={handleLogout} className="btn-secondary py-1.5">
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="btn-secondary py-1.5">
                  Log in
                </Link>
                <Link href="/auth/signup" className="btn-primary py-1.5">
                  Sign up
                </Link>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <LanguageSwitcher />
            <button
              onClick={() => setIsMobileMenuOpen((current) => !current)}
              type="button"
              aria-label="Toggle menu"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-navigation"
              className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm font-bold text-slate-700"
            >
              Menu
            </button>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div
          id="mobile-navigation"
          ref={mobileMenuRef}
          role="navigation"
          aria-label="Mobile menu"
          className="border-t border-slate-200 bg-white lg:hidden"
        >
          <div className="app-shell py-3">
            <div className="grid gap-1">
              {visibleNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-md px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="mt-3 border-t border-slate-200 pt-3">
              {isAuthenticated ? (
                <div className="flex flex-col gap-2">
                  <p className="px-3 text-sm font-semibold text-slate-600">
                    Signed in as <span className="font-bold text-slate-950">{session?.user?.name}</span>
                  </p>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="btn-secondary w-full"
                  >
                    Log out
                  </button>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Link href="/auth/login" onClick={() => setIsMobileMenuOpen(false)} className="btn-secondary">
                    Log in
                  </Link>
                  <Link href="/auth/signup" onClick={() => setIsMobileMenuOpen(false)} className="btn-primary">
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
