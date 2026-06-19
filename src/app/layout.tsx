import type { Metadata } from "next";
import Providers from "./Providers";
import { headers } from "next/headers";
import { defaultLocale, getTextDirection, isAppLocale } from "@/shared/i18n-config";
import { Nunito } from "next/font/google";
import "@fontsource-variable/inter";
import "./globals.css";

import Sidebar from "@/shared/components/Theme/Sidebar";
import Topbar from "@/shared/components/Theme/Topbar";
import Footer from "@/shared/components/Theme/Footer";

const nunito = Nunito({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "EPA Elearning",
  description: "Environmental learning and training for multilateral environmental agreements",
};

async function loadMessages(locale: string) {
  try {
    return (await import(`../messages/${locale}.json`)).default;
  } catch {
    return (await import("../messages/en.json")).default;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestedLocale = (await headers()).get("x-next-locale");
  const locale = isAppLocale(requestedLocale) ? requestedLocale : defaultLocale;
  const direction = getTextDirection(locale);
  const messages = await loadMessages(locale);

  return (
    <html lang={locale} dir={direction} className={nunito.variable}>
      <head>
        <link href="/fontawesome-free/css/all.min.css" rel="stylesheet" type="text/css" />
      </head>
      <body id="page-top" className="min-h-screen antialiased bg-[#f8f9fc] text-[#5a5c69] font-sans">
        <Providers locale={locale} messages={messages}>
          <div id="wrapper" className="flex h-screen w-full overflow-hidden">
            <Sidebar />
            <div id="content-wrapper" className="flex flex-col flex-1 w-full overflow-hidden bg-[#f8f9fc]">
              <div id="content" className="flex-1 flex flex-col overflow-y-auto">
                <Topbar />
                <main className="flex-1 w-full p-6">
                  {children}
                </main>
              </div>
              <Footer />
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
