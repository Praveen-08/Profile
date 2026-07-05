"use client";

import { cx } from "@/lib/utils";

export interface TabItem {
  key: string;
  label: string;
  badge?: number;
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="no-print -mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
      <div className="flex gap-1 border-b border-ink/10">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cx(
              "shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
              active === tab.key
                ? "border-gold text-ink"
                : "border-transparent text-ink/50 hover:text-ink"
            )}
          >
            {tab.label}
            {typeof tab.badge === "number" && tab.badge > 0 && (
              <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
