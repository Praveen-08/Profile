"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function NewProjectButton({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    try {
      const project = await api.createProject(token, {});
      router.push(`/projects/${project.id}/upload`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={create} disabled={loading}>
      {loading ? "Creating…" : "New Project"}
    </Button>
  );
}
