import type { ReactNode } from "react";

type BadgeTone = "blue" | "green" | "sky" | "neutral";

const toneClasses: Record<BadgeTone, string> = {
  blue: "bg-brand-blue/10 text-brand-blue",
  green: "bg-brand-green/20 text-emerald-700 dark:text-emerald-300",
  sky: "bg-brand-sky/20 text-sky-700 dark:text-sky-300",
  neutral: "bg-black/5 text-[var(--ink-muted)] dark:bg-white/10",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
