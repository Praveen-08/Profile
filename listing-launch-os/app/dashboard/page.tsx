import { AppNav } from "@/components/app/AppNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/server";
import { campaignFromRow, TARGET_BUYER_LABELS, type CampaignRow } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Explicit user_id filter in addition to RLS: never rely on RLS alone.
  const { data: rows } = user
    ? await supabase
        .from("campaigns")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    : { data: null };

  const campaigns = ((rows as CampaignRow[]) || []).map(campaignFromRow);

  return (
    <>
      <AppNav active="dashboard" />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl">Your campaigns</h1>
            <p className="mt-1 text-sm text-ink/60">Every listing launch pack you've created.</p>
          </div>
          <Button href="/campaigns/new">New campaign</Button>
        </div>

        {campaigns.length === 0 ? (
          <Card className="mt-10 flex flex-col items-center gap-4 p-16 text-center">
            <p className="font-serif text-xl">No campaigns yet</p>
            <p className="max-w-sm text-sm text-ink/60">
              Create your first listing to generate a full launch pack — descriptions, social captions, reel
              scripts and more, all in one place.
            </p>
            <Button href="/campaigns/new">Create your first campaign</Button>
          </Card>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => (
              <Link key={c.id} href={`/campaigns/${c.id}`}>
                <Card className="h-full p-5 transition-shadow hover:shadow-lg">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium leading-snug">{c.address}</h3>
                    <Badge className={c.status === "generated" ? "" : "bg-ink/10 text-ink/60"}>
                      {c.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink/60">{c.suburb}</p>
                  <p className="mt-3 text-xs text-ink/40">
                    {TARGET_BUYER_LABELS[c.targetBuyer]} · {formatDate(c.createdAt)}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
