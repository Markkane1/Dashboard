"use client";

import React from 'react';
import { SessionProvider } from 'next-auth/react';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import type { AppLocale } from '@/shared/i18n-config';

export default function Providers({
  children,
  locale,
  messages,
}: {
  children: React.ReactNode;
  locale: AppLocale;
  messages: AbstractIntlMessages;
}) {
  return (
    <SessionProvider>
      <NextIntlClientProvider formats={{}} locale={locale} messages={messages} now={new Date()} timeZone="UTC">
        {children}
      </NextIntlClientProvider>
    </SessionProvider>
  );
}
