import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";
import { Nav } from "@/components/Nav";
import { ProjectHubClient } from "./ProjectHubClient";

export default async function ProjectHubPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const project = await api.getProject(session.access_token, params.id);

  if (project.status === "DRAFT" || project.status === "UPLOADING" || project.status === "ANALYZING") {
    redirect(`/projects/${project.id}/upload`);
  }

  const comments = await api.listComments(session.access_token, project.id).catch(() => []);

  return (
    <main className="min-h-screen">
      <Nav email={session.user.email} />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <ProjectHubClient token={session.access_token} project={project} initialComments={comments} />
      </div>
    </main>
  );
}
