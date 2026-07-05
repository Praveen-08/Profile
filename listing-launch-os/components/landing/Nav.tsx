import { Button } from "@/components/ui/Button";
import Link from "next/link";

export function Nav() {
  return (
    <nav className="sticky top-0 z-30 border-b border-ink/10 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-serif text-lg font-semibold tracking-tight">
          Listing Launch <span className="text-gold-dark">OS</span>
        </Link>
        <div className="flex items-center gap-3">
          <Button href="/login" variant="ghost" size="sm">
            Log in
          </Button>
          <Button href="/login" variant="primary" size="sm">
            Get started
          </Button>
        </div>
      </div>
    </nav>
  );
}
