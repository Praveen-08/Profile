import { cx } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

interface FieldWrapperProps {
  label?: string;
  hint?: string;
  required?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldWrapperProps>(
  ({ label, hint, required, className, id, ...props }, ref) => {
    return (
      <label className="block">
        {label && (
          <span className="mb-1.5 block text-sm font-medium text-ink">
            {label}
            {required && <span className="text-gold-dark"> *</span>}
          </span>
        )}
        <input
          ref={ref}
          id={id}
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
Input.displayName = "Input";
