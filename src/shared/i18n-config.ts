export const locales = ["en", "ur"] as const;
export const defaultLocale = "en";

export type AppLocale = (typeof locales)[number];

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export function getTextDirection(locale: string) {
  return locale === "ur" ? "rtl" : "ltr";
}
