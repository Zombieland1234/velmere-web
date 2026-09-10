import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

type LuxurySectionProps<T extends ElementType = "section"> = {
  as?: T;
  bleed?: boolean;
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export default function LuxurySection<T extends ElementType = "section">({
  as,
  bleed = false,
  children,
  className,
  ...props
}: LuxurySectionProps<T>) {
  const Component = as ?? "section";

  return (
    <Component
      className={cn(!bleed && "mx-auto max-w-[1600px] px-6 md:px-12 xl:px-16", className)}
      {...props}
    >
      {children}
    </Component>
  );
}
