import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";
import { Nav } from "@/components/Nav";
import { DownloadClient } from "./DownloadClient";

export default async function DownloadPage({ params }: { params: { id: string; versionId: string } }) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const render = await api.getLatestRender(session.access_token, params.id, params.versionId).catch(() => null);
  if (!render || render.status !== "COMPLETE" || !render.outputUrl) {
    redirect(`/projects/${params.id}/versions/${params.versionId}/render`);
  }

  const [exports, shareLinks] = await Promise.all([
    api.listExports(session.access_token, params.id, render.id).catch(() => []),
    api.listShareLinks(session.access_token, params.id).catch(() => []),
  ]);

  return (
    <main className="min-h-screen">
      <Nav email={session.user.email} />
      <div className="mx-auto max-w-xl px-6 py-16">
        <DownloadClient
          token={session.access_token}
          projectId={params.id}
          versionId={params.versionId}
          render={render}
          initialExports={exports}
          initialShareLinks={shareLinks.filter((s) => s.renderId === render.id)}
        />
      </div>
    </main>
  );
}
