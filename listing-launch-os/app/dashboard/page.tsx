import { AppNav } from "@/components/app/AppNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/server";
import { getPlan, planHasModule } from "@/lib/plans";
import { getCampaignUsage } from "@/lib/campaignUsage";
import {
  campaignFromRow,
  MEETING_TYPE_LABELS,
  TARGET_BUYER_LABELS,
  VENDOR_UPDATE_TYPE_LABELS,
  type CampaignRow,
  type MeetingType,
  type VendorUpdateType,
} from "@/lib/types";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface VendorUpdatePreviewRow {
  id: string;
  update_type: VendorUpdateType;
  created_at: string;
  campaigns: { address: string; suburb: string } | { address: string; suburb: string }[] | null;
}

interface PlaybookPreviewRow {
  id: string;
  meeting_type: MeetingType;
  property_address: string;
  suburb: string;
  created_at: string;
}

function campaignLabel(row: VendorUpdatePreviewRow): string {
  const campaign = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns;
  return campaign ? `${campaign.address}, ${campaign.suburb}` : "Unknown listing";
}

function LockedModuleNotice({ label }: { label: string }) {
  return (
    <Card className="mt-6 flex flex-col items-center gap-3 p-8 text-center">
      <Badge>Pro feature</Badge>
      <p className="text-sm text-ink/60">{label} is included in Pro and Growth.</p>
      <Link href="/#pricing" className="text-sm text-gold-dark underline">
        View Pro Plan
      </Link>
    </Card>
  );
}

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Plan usage is read fresh from Supabase on every request — never cached
  // or stored client-side — so it's always accurate after creating/generating
  // a campaign.
  const usage = user ? await getCampaignUsage(supabase, user.id) : null;
  const plan = usage?.plan ?? getPlan(undefined);
  const hasMeetingPlaybookAccess = planHasModule(plan.id, "meeting_playbook");
  const hasVendorUpdateAccess = planHasModule(plan.id, "vendor_update_report");

  // Explicit user_id filter in addition to RLS: never rely on RLS alone.
  const { data: playbookRows } = user && hasMeetingPlaybookAccess
    ? await supabase
        .from("agent_meeting_playbooks")
        .select("id, meeting_type, property_address, suburb, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3)
    : { data: null };

  const { data: campaignRows } = user
    ? await supabase
        .from("campaigns")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    : { data: null };

  const { data: vendorUpdateRows } = user && hasVendorUpdateAccess
    ? await supabase
        .from("vendor_updates")
        .select("id, update_type, created_at, campaigns(address, suburb)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3)
    : { data: null };

  const playbooks = (playbookRows as PlaybookPreviewRow[]) || [];
  const campaigns = ((campaignRows as CampaignRow[]) || []).map(campaignFromRow);
  const vendorUpdates = (vendorUpdateRows as VendorUpdatePreviewRow[]) || [];

  const campaignsUsed = usage?.count ?? campaigns.length;
  const freeCampaignUsed = plan.id === "free" && (usage?.limitReached ?? false);

  const MODULES = [
    { title: "Win the Listing", href: "/meeting-playbooks", locked: !hasMeetingPlaybookAccess, body: "Meeting playbooks, vendor questions, and marketing package recommendations." },
    { title: "Launch the Listing", href: "/dashboard", locked: false, body: "Turn one property form into a full campaign pack." },
    { title: "Manage the Campaign", href: "/vendor-updates", locked: !hasVendorUpdateAccess, body: "Turn campaign activity into professional vendor updates." },
  ];

  return (
    <>
      <AppNav active="dashboard" />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-ink/60">Current plan:</span>
            <Badge>{plan.name}</Badge>
            {plan.id === "free" && (
              <span className="text-sm text-ink/60">
                Free plan: {plan.campaignLimit} campaign included · Used: {campaignsUsed} / {plan.campaignLimit}
                {freeCampaignUsed ? " · Upgrade to continue" : ""}
              </span>
            )}
          </div>
          <Link href="/#pricing" className="text-sm text-gold-dark underline">
            View Plans
          </Link>
        </Card>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {MODULES.map((m) => (
            <Link key={m.title} href={m.href}>
              <Card className="h-full p-4 transition-shadow hover:shadow-lg">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{m.title}</h3>
                  <Badge className={m.locked ? "bg-ink/10 text-ink/50" : ""}>{m.locked ? "Pro" : "Active"}</Badge>
                </div>
                <p className="mt-1 text-xs text-ink/60">{m.body}</p>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-10 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl">Win the Listing</h2>
            <p className="mt-1 text-sm text-ink/60">Prepare for your next appraisal or vendor meeting.</p>
          </div>
          {hasMeetingPlaybookAccess && <Button href="/meeting-playbooks/new">Create Meeting Playbook</Button>}
        </div>

        {!hasMeetingPlaybookAccess ? (
          <LockedModuleNotice label="The Agent Meeting Playbook" />
        ) : playbooks.length === 0 ? (
          <Card className="mt-6 flex flex-col items-center gap-4 p-10 text-center">
            <p className="text-sm text-ink/60">
              No meeting playbooks yet. Before your next appraisal or vendor pitch, create one to walk in prepared.
            </p>
          </Card>
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {playbooks.map((p) => (
                <Link key={p.id} href={`/meeting-playbooks/${p.id}`}>
                  <Card className="h-full p-5 transition-shadow hover:shadow-lg">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium leading-snug">
                        {p.property_address}, {p.suburb}
                      </h3>
                      <Badge>{MEETING_TYPE_LABELS[p.meeting_type]}</Badge>
                    </div>
                    <p className="mt-3 text-xs text-ink/40">{formatDate(p.created_at)}</p>
                  </Card>
                </Link>
              ))}
            </div>
            <Link href="/meeting-playbooks" className="mt-4 inline-block text-sm text-gold-dark underline">
              View all meeting playbooks
            </Link>
          </>
        )}

        <div className="mt-12 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl">Launch the Listing</h2>
            <p className="mt-1 text-sm text-ink/60">Every listing launch pack you've created.</p>
          </div>
          <Button href="/campaigns/new">New campaign</Button>
        </div>

        {campaigns.length === 0 ? (
          <Card className="mt-6 flex flex-col items-center gap-4 p-16 text-center">
            <p className="font-serif text-xl">No campaigns yet</p>
            <p className="max-w-sm text-sm text-ink/60">
              Create your first listing to generate a full launch pack — descriptions, social captions, reel
              scripts and more, all in one place.
            </p>
            <Button href="/campaigns/new">Create your first campaign</Button>
          </Card>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

        <div className="mt-12 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl">Manage the Campaign</h2>
            <p className="mt-1 text-sm text-ink/60">Turn open-home and campaign activity into a vendor update.</p>
          </div>
          {hasVendorUpdateAccess && <Button href="/vendor-updates/new">Create Vendor Update</Button>}
        </div>

        {!hasVendorUpdateAccess ? (
          <LockedModuleNotice label="Vendor Update Reports" />
        ) : vendorUpdates.length === 0 ? (
          <Card className="mt-6 flex flex-col items-center gap-4 p-10 text-center">
            <p className="text-sm text-ink/60">
              No vendor updates yet. After your next open home or weekly review, create one to keep vendors
              informed.
            </p>
          </Card>
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <Link href="/vendor-updates" className="mt-4 inline-block text-sm text-gold-dark underline">
              View all vendor updates
            </Link>
          </>
        )}
      </main>
    </>
  );
}
