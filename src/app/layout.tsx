import type { Metadata } from "next";
import Navbar from "@/shared/components/Navbar";
import Footer from "@/shared/components/Footer";
import Providers from "./Providers";
import { headers } from "next/headers";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "EPA Elearning",
  description: "Environmental learning and training for multilateral environmental agreements",
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
      <body className="min-h-screen antialiased">
        <Providers locale={locale} messages={messages}>
          <a href="#main-content" className="skip-link">Skip to main content</a>
          <Navbar />
          <main id="main-content" tabIndex={-1}>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
