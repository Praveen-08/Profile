import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";
import { Nav } from "@/components/Nav";
import { ConfigureClient } from "./ConfigureClient";

export default async function ConfigurePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { version?: string };
}) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const project = await api.getProject(session.access_token, params.id);

  if (project.status === "DRAFT" || project.status === "UPLOADING" || project.status === "ANALYZING") {
    redirect(`/projects/${project.id}/upload`);
  }

  let versionId = searchParams.version;
  if (!versionId) {
    if (project.versions.length === 0) {
      const created = await api.createVersion(session.access_token, project.id, {});
      versionId = created.id;
    } else {
      versionId = project.versions[0].id;
    }
  }

  const [version, styles, brandKits] = await Promise.all([
    api.getVersion(session.access_token, project.id, versionId),
    api.listStyles(session.access_token),
    api.listBrandKits(session.access_token),
  ]);

  return (
    <main className="min-h-screen">
      <Nav email={session.user.email} />
      <div className="mx-auto max-w-5xl px-6 py-10">
        <ConfigureClient token={session.access_token} project={project} version={version} styles={styles} brandKits={brandKits} />
      </div>
    </main>
  );
}
