import Link from "next/link";
import { redirect } from "next/navigation";

export const locales = ["en", "pak"] as const;
export const defaultLocale = "en";
export { Link, redirect };
