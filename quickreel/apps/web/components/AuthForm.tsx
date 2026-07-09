"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "error" | "info"; message?: string }>({
    type: "idle",
  });

  const supabase = createClient();

  async function handlePasswordAuth(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ type: "loading" });
    const { error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (error) {
      setStatus({ type: "error", message: error.message });
      return;
    }
    if (mode === "signup") {
      setStatus({ type: "info", message: "Check your email to confirm your account." });
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  async function handleMagicLink() {
    if (!email) {
      setStatus({ type: "error", message: "Enter your email first." });
      return;
    }
    setStatus({ type: "loading" });
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setStatus(
      error ? { type: "error", message: error.message } : { type: "info", message: "Magic link sent — check your email." },
    );
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onSubmit={handlePasswordAuth}
      className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-surface p-8"
    >
      <h1 className="font-serif text-2xl font-semibold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {status.type === "error" && <p className="text-sm text-red-400">{status.message}</p>}
      {status.type === "info" && <p className="text-sm text-accent">{status.message}</p>}

      <Button type="submit" className="w-full" disabled={status.type === "loading"}>
        {mode === "login" ? "Sign in" : "Sign up"}
      </Button>
      <Button type="button" variant="secondary" className="w-full" onClick={handleMagicLink} disabled={status.type === "loading"}>
        Email me a magic link
      </Button>
    </motion.form>
  );
}
