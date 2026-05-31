import type { Metadata } from "next";
import Navbar from "@/shared/components/Navbar";
import Footer from "@/shared/components/Footer";
import Providers from "./Providers";
import { headers } from "next/headers";
import { Inter, Sora } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

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
    <html lang={locale} dir={direction} className={`${inter.variable} ${sora.variable}`}>
      <body className="min-h-screen antialiased bg-brand-background relative overflow-x-hidden">
        {/* Background Organic Blobs for Fluid Institutional Aesthetic */}
        <div className="absolute top-[-10vw] left-[-10vw] w-[50vw] h-[50vw] organic-blob blob-emerald" />
        <div className="absolute top-[35vh] right-[-15vw] w-[45vw] h-[45vw] organic-blob blob-mint" />
        <div className="absolute bottom-[-10vh] left-[15vw] w-[40vw] h-[40vw] organic-blob blob-emerald" />

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
