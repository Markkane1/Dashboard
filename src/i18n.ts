import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async ({ locale }) => {
  const activeLocale = locale || "en";
  let messages;

  try {
    messages = (await import(`../messages/${activeLocale}.json`)).default;
  } catch (error) {
    messages = (await import("../messages/en.json")).default;
  }

  return {
    locale: activeLocale,
    messages,
  };
});
