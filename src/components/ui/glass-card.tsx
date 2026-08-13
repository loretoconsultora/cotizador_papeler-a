import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type GlassCardProps = HTMLAttributes<HTMLDivElement> & { strong?: boolean };

export function GlassCard({ className, strong, ...props }: GlassCardProps) {
  return (
    <div
      className={cn(strong ? "glass-strong" : "glass", "rounded-3xl p-6", className)}
      {...props}
    />
  );
}
