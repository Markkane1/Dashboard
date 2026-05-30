import { createNavigation } from "next-intl/navigation";

export const locales = ["en", "pak"] as const;
export const defaultLocale = "en";

export const { Link, redirect, usePathname, useRouter } = createNavigation({
  locales,
});
