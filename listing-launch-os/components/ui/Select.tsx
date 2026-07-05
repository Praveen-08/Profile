import { cx } from "@/lib/utils";
import { forwardRef, type SelectHTMLAttributes } from "react";

interface FieldWrapperProps {
  label?: string;
  required?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldWrapperProps>(
  ({ label, required, className, id, children, ...props }, ref) => {
    return (
      <label className="block">
        {label && (
          <span className="mb-1.5 block text-sm font-medium text-ink">
            {label}
            {required && <span className="text-gold-dark"> *</span>}
          </span>
        )}
        <select
          ref={ref}
          id={id}
          className={cx(
            "w-full rounded-lg border border-ink/15 bg-white px-3.5 py-2.5 text-sm text-ink",
            "focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold",
            className
          )}
          {...props}
        >
          {children}
        </select>
      </label>
    );
  }
);
Select.displayName = "Select";
