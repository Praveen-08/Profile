import { AppNav } from "@/components/app/AppNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/server";
import { VENDOR_UPDATE_TYPE_LABELS, type VendorUpdateType } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface VendorUpdateListRow {
  id: string;
  update_type: VendorUpdateType;
  created_at: string;
  campaigns: { address: string; suburb: string } | { address: string; suburb: string }[] | null;
}

function campaignLabel(row: VendorUpdateListRow): string {
  const campaign = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns;
  return campaign ? `${campaign.address}, ${campaign.suburb}` : "Unknown listing";
}

export default async function VendorUpdatesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Explicit user_id filter in addition to RLS.
  const { data: rows } = user
    ? await supabase
        .from("vendor_updates")
        .select("id, update_type, created_at, campaigns(address, suburb)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    : { data: null };

  const vendorUpdates = (rows as VendorUpdateListRow[]) || [];

  return (
    <>
      <AppNav active="vendor-updates" />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl">Vendor updates</h1>
            <p className="mt-1 text-sm text-ink/60">Every vendor update report you've generated — manage the campaign, one update at a time.</p>
          </div>
          <Button href="/vendor-updates/new">Create Vendor Update</Button>
        </div>

        {vendorUpdates.length === 0 ? (
          <Card className="mt-10 flex flex-col items-center gap-4 p-16 text-center">
            <p className="font-serif text-xl">No vendor updates yet</p>
            <p className="max-w-sm text-sm text-ink/60">
              After an open home or weekly campaign review, create a vendor update to turn what happened into a
              professional report.
            </p>
            <Button href="/vendor-updates/new">Create your first vendor update</Button>
          </Card>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vendorUpdates.map((v) => (
              <Link key={v.id} href={`/vendor-updates/${v.id}`}>
                <Card className="h-full p-5 transition-shadow hover:shadow-lg">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium leading-snug">{campaignLabel(v)}</h3>
                    <Badge>{VENDOR_UPDATE_TYPE_LABELS[v.update_type]}</Badge>
                  </div>
                  <p className="mt-3 text-xs text-ink/40">{formatDate(v.created_at)}</p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
