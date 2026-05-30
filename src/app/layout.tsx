import type { Metadata } from "next";
import Navbar from "@/shared/components/Navbar";
import Footer from "@/shared/components/Footer";
import { SessionProvider } from "next-auth/react";
import { NextIntlClientProvider } from "next-intl";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "InforMEA Learning",
  description: "United Nations Information Portal on Multilateral Environmental Agreements",
};

async function loadMessages(locale: string) {
  try {
    return (await import(`../../messages/${locale}.json`)).default;
  } catch {
    return (await import("../../messages/en.json")).default;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = headers().get("x-next-locale") || "en";
  const direction = locale === "pak" ? "rtl" : "ltr";
  const messages = await loadMessages(locale);

  return (
    <html lang={locale} dir={direction}>
      <body className="min-h-screen bg-gray-50 antialiased" style={{ fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <SessionProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <Navbar />
            <main>{children}</main>
            <Footer />
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
