"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function AppNav({ active }: { active?: "dashboard" | "settings" }) {
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
          Listing Launch <span className="text-gold-dark">OS</span>
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/dashboard" className={active === "dashboard" ? "font-medium text-ink" : "text-ink/60"}>
            Campaigns
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
