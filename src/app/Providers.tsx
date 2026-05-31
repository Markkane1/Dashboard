"use client";

import React from 'react';
import { SessionProvider } from 'next-auth/react';
import { NextIntlClientProvider } from 'next-intl';

export default function Providers({
  children,
  locale,
  messages,
}: {
  children: React.ReactNode;
  locale: string;
  messages: Record<string, string>;
}) {
  return (
    <SessionProvider>
      <NextIntlClientProvider formats={{}} locale={locale} messages={messages} now={new Date()} timeZone="UTC">
        {children}
      </NextIntlClientProvider>
    </SessionProvider>
  );
}
