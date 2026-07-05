import { cx } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx("rounded-2xl border border-ink/10 bg-white shadow-premium", className)}
      {...props}
    />
  );
}
