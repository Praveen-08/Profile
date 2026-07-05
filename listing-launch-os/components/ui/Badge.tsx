import { cx } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full bg-gold/15 px-3 py-1 text-xs font-medium uppercase tracking-wider text-gold-dark",
        className
      )}
      {...props}
    />
  );
}
