import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";
import { Nav } from "@/components/Nav";
import { BrandKitClient } from "./BrandKitClient";

export default async function BrandKitPage() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const brandKits = await api.listBrandKits(session.access_token).catch(() => []);

  return (
    <main className="min-h-screen">
      <Nav email={session.user.email} />
      <div className="mx-auto max-w-3xl px-6 py-10">
        <BrandKitClient token={session.access_token} initialBrandKits={brandKits} />
      </div>
    </main>
  );
}
