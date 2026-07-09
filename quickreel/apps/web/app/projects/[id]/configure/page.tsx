import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";
import { Nav } from "@/components/Nav";
import { ConfigureClient } from "./ConfigureClient";

export default async function ConfigurePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const [project, styles] = await Promise.all([
    api.getProject(session.access_token, params.id),
    api.listStyles(session.access_token),
  ]);

  if (project.status === "DRAFT" || project.status === "UPLOADING" || project.status === "ANALYZING") {
    redirect(`/projects/${project.id}/upload`);
  }

  return (
    <main className="min-h-screen">
      <Nav email={session.user.email} />
      <div className="mx-auto max-w-5xl px-6 py-10">
        <ConfigureClient token={session.access_token} project={project} styles={styles} />
      </div>
    </main>
  );
}
