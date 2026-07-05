"use client";

import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RetryVendorUpdateButton({ vendorUpdateId }: { vendorUpdateId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRetry() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/vendor-updates/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorUpdateId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Generation failed.");
      setLoading(false);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <Button onClick={handleRetry} disabled={loading}>
        {loading ? "Generating…" : "Retry generation"}
      </Button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
