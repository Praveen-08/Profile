"use client";

import { cx } from "@/lib/utils";
import { useState } from "react";

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable; fail silently
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cx(
        "rounded-full border border-ink/15 px-3 py-1 text-xs font-medium text-ink/70 transition-colors hover:border-gold hover:text-ink",
        className
      )}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
