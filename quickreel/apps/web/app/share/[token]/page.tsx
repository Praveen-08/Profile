import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { SharePageClient } from "./SharePageClient";

export default async function SharePage({ params }: { params: { token: string } }) {
  const data = await api.getSharePage(params.token).catch(() => null);
  if (!data) notFound();

  return (
    <main className="min-h-screen">
      <header className="border-b border-border px-6 py-4">
        <span className="font-serif text-lg font-semibold">
          QuickReel <span className="text-accent">AI</span>
        </span>
      </header>
      <div className="mx-auto max-w-xl px-6 py-12">
        <SharePageClient token={params.token} initialData={data} />
      </div>
    </main>
  );
}
