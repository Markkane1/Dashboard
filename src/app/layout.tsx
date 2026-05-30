import type { Metadata } from "next";
import Navbar from "@/shared/components/Navbar";
import Footer from "@/shared/components/Footer";
import { SessionProvider } from "next-auth/react";
import { NextIntlClientProvider } from "next-intl";
import "./globals.css";

export const metadata: Metadata = {
  title: "InforMEA Learning",
  description: "United Nations Information Portal on Multilateral Environmental Agreements",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 antialiased" style={{ fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <SessionProvider>
          <NextIntlClientProvider locale="en" messages={{}}>
            <Navbar />
            <main>{children}</main>
            <Footer />
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
