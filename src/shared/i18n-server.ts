import en from "../messages/en.json";
import ur from "../messages/ur.json";

export type MessagesType = typeof en;

export function getTranslationsServer(locale: string) {
  const messages = (locale === "ur" ? ur : en) as any;

  return (key: string): string => {
    const parts = key.split(".");
    let current: any = messages;
    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = current[part];
      } else {
        return key;
      }
    }
    return typeof current === "string" ? current : key;
  };
}
