"use client";

import { cx } from "@/lib/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function GeneratedBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const generated = searchParams.get("generated");
  const [visible, setVisible] = useState(!!generated);

  useEffect(() => {
    setVisible(!!generated);
  }, [generated]);

  if (!visible || !generated) return null;

  const isSuccess = generated === "success";

  function dismiss() {
    setVisible(false);
    router.replace(pathname);
  }

  return (
    <div
      className={cx(
        "no-print mb-6 flex items-center justify-between gap-3 rounded-xl border p-4 text-sm",
        isSuccess ? "border-gold/40 bg-gold/5 text-ink/80" : "border-red-200 bg-red-50 text-red-700"
      )}
    >
      <p>
        {isSuccess
          ? "Campaign generated and saved"
          : "Campaign generated, but saving failed. Please click Save Campaign or copy your output before leaving."}
      </p>
      <button onClick={dismiss} className="shrink-0 text-xs underline opacity-70 hover:opacity-100">
        Dismiss
      </button>
    </div>
  );
}
