import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isAppLocale } from "@/shared/i18n-config";

export default getRequestConfig(async ({ locale }) => {
  const activeLocale = isAppLocale(locale) ? locale : defaultLocale;

  try {
    const messages = (await import(`./messages/${activeLocale}.json`)).default;
    return {
      locale: activeLocale,
      messages,
    };
  } catch {
    const messages = (await import(`./messages/${defaultLocale}.json`)).default;
    return {
      locale: defaultLocale,
      messages,
    };
  }
});
