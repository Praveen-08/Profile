import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";
import { Nav } from "@/components/Nav";
import { DownloadClient } from "./DownloadClient";

export default async function DownloadPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const render = await api.getLatestRender(session.access_token, params.id).catch(() => null);
  if (!render || render.status !== "COMPLETE" || !render.outputUrl) {
    redirect(`/projects/${params.id}/render`);
  }

  return (
    <main className="min-h-screen">
      <Nav email={session.user.email} />
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <DownloadClient videoUrl={render.outputUrl} durationSec={render.outputDurationSec} projectId={params.id} />
      </div>
    </main>
  );
}
