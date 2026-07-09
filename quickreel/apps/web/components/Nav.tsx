"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function Nav({ email }: { email?: string }) {
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-4">
      <Link href="/dashboard" className="font-serif text-lg font-semibold">
        QuickReel <span className="text-accent">AI</span>
      </Link>
      <div className="flex items-center gap-4">
        <Link href="/brand-kit" className="text-sm text-muted hover:text-foreground">
          Brand Kit
        </Link>
        {email && <span className="text-sm text-muted">{email}</span>}
        <Button variant="ghost" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
