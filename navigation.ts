import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
export const locales = routing.locales;
export type AppLocale = (typeof locales)[number];
