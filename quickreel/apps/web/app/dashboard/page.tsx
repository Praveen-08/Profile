import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";
import { Nav } from "@/components/Nav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewProjectButton } from "./NewProjectButton";
import { StatCard } from "./StatCard";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const [projects, dashboard] = await Promise.all([
    api.listProjects(session.access_token).catch(() => []),
    api.getDashboard(session.access_token).catch(() => null),
  ]);

  return (
    <main className="min-h-screen">
      <Nav email={session.user.email} />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-semibold">Welcome back</h1>
            <p className="mt-1 text-muted">Upload photos, pick a style, and let the AI Director cut your reel.</p>
          </div>
          <NewProjectButton token={session.access_token} />
        </div>

        {dashboard && (
          <>
            <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Projects" value={String(dashboard.analytics.totalProjects)} />
              <StatCard label="Reels Rendered" value={String(dashboard.analytics.completedRenders)} />
              <StatCard
                label="Storage Used"
                value={formatBytes(dashboard.storage.imagesBytes + dashboard.storage.rendersBytes)}
              />
              <StatCard label="Brand Kit" value={dashboard.brandKit ? dashboard.brandKit.name : "Not set up"} />
            </div>

            {dashboard.renderingStatus.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Rendering Now</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {dashboard.renderingStatus.map((r) => (
                    <Link key={r.renderId} href={`/projects/${r.projectId}`}>
                      <Card className="flex items-center justify-between p-4 transition-colors hover:border-accent/50">
                        <span className="truncate text-sm font-medium">{r.title}</span>
                        <Badge>{r.status}</Badge>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {dashboard.recentReels.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Recent Reels</h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {dashboard.recentReels.map((r) => (
                    <Link key={r.renderId} href={`/projects/${r.projectId}`}>
                      <Card className="overflow-hidden transition-colors hover:border-accent/50">
                        <div className="relative aspect-[9/16] w-full bg-black">
                          {r.outputUrl && (
                            <video src={r.outputUrl} muted playsInline className="h-full w-full object-cover" />
                          )}
                          {r.overallScore !== null && (
                            <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-accent">
                              {r.overallScore}
                            </span>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="truncate text-sm font-medium">{r.title}</p>
                          <p className="text-xs text-muted">{r.styleName ?? "—"}</p>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {dashboard.favouriteStyles.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Favourite Styles</h2>
                <div className="flex flex-wrap gap-2">
                  {dashboard.favouriteStyles.map((s) => (
                    <Badge key={s.slug}>
                      {s.name} · {s.count}
                    </Badge>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Your Projects</h2>
          {projects.length === 0 ? (
            <Card className="p-12 text-center text-muted">No projects yet — create your first one above.</Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <Card className="h-full transition-colors hover:border-accent/50">
                    <CardHeader>
                      <div className="mb-2 flex items-center justify-between">
                        <Badge>{project.status}</Badge>
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
        </section>
      </div>
    </main>
  );
}
