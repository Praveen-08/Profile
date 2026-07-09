import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { RenderStatusClient } from "./RenderStatusClient";

export default async function RenderPage({ params }: { params: { id: string; versionId: string } }) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  return (
    <main className="min-h-screen">
      <Nav email={session.user.email} />
      <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-20 text-center">
        <RenderStatusClient token={session.access_token} projectId={params.id} versionId={params.versionId} />
      </div>
    </main>
  );
}
