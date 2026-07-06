import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "warning" | "danger" | "outline";

const variantClasses: Record<Variant, string> = {
  default: "bg-accent text-accent-foreground",
  success: "bg-emerald-600 text-white",
  warning: "bg-amber-500 text-black",
  danger: "bg-destructive text-destructive-foreground",
  outline: "border border-border text-foreground",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
