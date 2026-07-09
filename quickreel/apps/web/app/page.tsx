import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <span className="mb-6 rounded-full border border-border bg-surface px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-muted">
        The AI Director Engine
      </span>
      <h1 className="max-w-3xl text-balance font-serif text-5xl font-semibold leading-tight md:text-6xl">
        Professionally edited reels,{" "}
        <span className="text-accent">generated automatically.</span>
      </h1>
      <p className="mt-6 max-w-xl text-lg text-muted">
        Upload your listing photos. QuickReel AI classifies every room, builds the story, and cuts a
        beat-synced cinematic reel — without ever touching a pixel of your photography.
      </p>
      <div className="mt-10 flex gap-4">
        <Link href="/dashboard">
          <Button size="lg">Open Dashboard</Button>
        </Link>
        <Link href="/login">
          <Button size="lg" variant="secondary">
            Sign In
          </Button>
        </Link>
      </div>
    </main>
  );
}
