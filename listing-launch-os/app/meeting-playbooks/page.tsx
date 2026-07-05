import { AppNav } from "@/components/app/AppNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LockedFeaturePrompt } from "@/components/plans/LockedFeaturePrompt";
import { createClient } from "@/lib/supabase/server";
import { planHasModule } from "@/lib/plans";
import { MEETING_TYPE_LABELS, type MeetingType } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PlaybookListRow {
  id: string;
  meeting_type: MeetingType;
  property_address: string;
  suburb: string;
  created_at: string;
}

export default async function MeetingPlaybooksPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("user_profiles").select("plan").eq("user_id", user.id).maybeSingle()
    : { data: null };

  const hasAccess = planHasModule(profile?.plan, "meeting_playbook");

  // Explicit user_id filter in addition to RLS.
  const { data: rows } = user && hasAccess
    ? await supabase
        .from("agent_meeting_playbooks")
        .select("id, meeting_type, property_address, suburb, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    : { data: null };

  const playbooks = (rows as PlaybookListRow[]) || [];

  return (
    <>
      <AppNav active="meeting-playbooks" />
      <main className="mx-auto max-w-6xl px-6 py-10">
        {!hasAccess ? (
          <LockedFeaturePrompt />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-serif text-2xl">Meeting playbooks</h1>
                <p className="mt-1 text-sm text-ink/60">
                  Win the listing — every appraisal and vendor meeting pack you've prepared.
                </p>
              </div>
              <Button href="/meeting-playbooks/new">Create Meeting Playbook</Button>
            </div>

            {playbooks.length === 0 ? (
              <Card className="mt-10 flex flex-col items-center gap-4 p-16 text-center">
                <p className="font-serif text-xl">No meeting playbooks yet</p>
                <p className="max-w-sm text-sm text-ink/60">
                  Before your next appraisal or vendor pitch, create a playbook to walk in prepared — checklist,
                  talking points, questions to ask, and a marketing package recommendation.
                </p>
                <Button href="/meeting-playbooks/new">Create your first meeting playbook</Button>
              </Card>
            ) : (
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            )}
          </>
        )}
      </main>
    </>
  );
}
