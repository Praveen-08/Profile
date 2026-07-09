import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";
import { Nav } from "@/components/Nav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewProjectButton } from "./NewProjectButton";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const projects = await api.listProjects(session.access_token).catch(() => []);

  return (
    <main className="min-h-screen">
      <Nav email={session.user.email} />
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-semibold">Your Projects</h1>
            <p className="mt-1 text-muted">Upload photos, pick a style, and let the AI Director cut your reel.</p>
          </div>
          <NewProjectButton token={session.access_token} />
        </div>

        {projects.length === 0 ? (
          <Card className="p-12 text-center text-muted">No projects yet — create your first one above.</Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}/upload`}>
                <Card className="h-full transition-colors hover:border-accent/50">
                  <CardHeader>
                    <div className="mb-2 flex items-center justify-between">
                      <Badge>{project.status}</Badge>
                      {project.reelLengthSec && <Badge>{project.reelLengthSec}s</Badge>}
                    </div>
                    <CardTitle>{project.title || project.address || "Untitled Listing"}</CardTitle>
                    <CardDescription>{new Date(project.createdAt).toLocaleDateString()}</CardDescription>
                  </CardHeader>
                  <CardContent />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
