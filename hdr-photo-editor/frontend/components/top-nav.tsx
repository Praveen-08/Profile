"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const STEPS = [
  { href: "/", label: "1. Upload" },
  { href: "/groups", label: "2. Auto Grouping" },
  { href: "/processing", label: "3. HDR Processing" },
  { href: "/preview", label: "4. Before / After" },
  { href: "/export", label: "5. Export" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-card/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <span className="text-sm font-semibold tracking-tight">HDR Architectural Editor</span>
        <nav className="flex flex-wrap gap-1">
          {STEPS.map((step) => (
            <Link
              key={step.href}
              href={step.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                pathname === step.href
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {step.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
