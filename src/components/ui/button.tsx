import { type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-linear-to-r from-brand-blue to-brand-sky text-white shadow-sm shadow-brand-blue/30 hover:brightness-105 active:brightness-95",
  secondary: "glass text-[var(--ink)] hover:bg-white/80",
  ghost: "text-[var(--ink-muted)] hover:text-[var(--ink)]",
  danger: "bg-red-500 text-white hover:bg-red-600",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
