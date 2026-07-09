import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";
import { Nav } from "@/components/Nav";
import { UploadClient } from "./UploadClient";

export default async function UploadPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const project = await api.getProject(session.access_token, params.id);

  return (
    <main className="min-h-screen">
      <Nav email={session.user.email} />
      <div className="mx-auto max-w-4xl px-6 py-10">
        <UploadClient token={session.access_token} projectId={project.id} initialImages={project.images} status={project.status} />
      </div>
    </main>
  );
}
