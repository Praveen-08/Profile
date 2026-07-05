"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function AppNav({
  active,
}: {
  active?: "dashboard" | "meeting-playbooks" | "vendor-updates" | "settings";
}) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="border-b border-ink/10 bg-paper">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/dashboard" className="font-serif text-lg font-semibold tracking-tight">
          Listing Launch
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link
            href="/meeting-playbooks"
            className={active === "meeting-playbooks" ? "font-medium text-ink" : "text-ink/60"}
          >
            Win the Listing
          </Link>
          <Link href="/dashboard" className={active === "dashboard" ? "font-medium text-ink" : "text-ink/60"}>
            Launch the Listing
          </Link>
          <Link
            href="/vendor-updates"
            className={active === "vendor-updates" ? "font-medium text-ink" : "text-ink/60"}
          >
            Manage the Campaign
          </Link>
          <Link href="/settings" className={active === "settings" ? "font-medium text-ink" : "text-ink/60"}>
            Settings
          </Link>
          <button onClick={handleLogout} className="text-ink/60 hover:text-ink">
            Log out
          </button>
        </div>
      </div>
    </nav>
  );
}
