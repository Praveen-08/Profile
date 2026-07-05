import { cx } from "@/lib/utils";
import { forwardRef, type TextareaHTMLAttributes } from "react";

interface FieldWrapperProps {
  label?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldWrapperProps>(
  ({ label, hint, className, id, rows = 3, ...props }, ref) => {
    return (
      <label className="block">
        {label && <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>}
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          className={cx(
            "w-full rounded-lg border border-ink/15 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink/35",
            "focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold",
            className
          )}
          {...props}
        />
        {hint && <span className="mt-1 block text-xs text-ink/50">{hint}</span>}
      </label>
    );
  }
);
Textarea.displayName = "Textarea";
