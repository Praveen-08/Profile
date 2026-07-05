import { AppNav } from "@/components/app/AppNav";
import { MeetingPlaybookOutputView } from "@/components/meeting-playbook/MeetingPlaybookOutputView";
import { RetryMeetingPlaybookButton } from "@/components/meeting-playbook/RetryMeetingPlaybookButton";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { agentMeetingPlaybookFromRow, MEETING_TYPE_LABELS, type AgentMeetingPlaybookRow } from "@/lib/types";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MeetingPlaybookOutputPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  // Explicit user_id filter in addition to RLS.
  const { data: row } = await supabase
    .from("agent_meeting_playbooks")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();
  if (!row) notFound();

  const playbook = agentMeetingPlaybookFromRow(row as AgentMeetingPlaybookRow);
  const hasOutputs = Object.keys(playbook.generatedOutput).length > 0;

  return (
    <>
      <AppNav active="meeting-playbooks" />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8">
          <h1 className="font-serif text-2xl">
            {playbook.propertyAddress}, {playbook.suburb}
          </h1>
          <p className="mt-1 text-xs uppercase tracking-wider text-gold-dark">
            {MEETING_TYPE_LABELS[playbook.meetingType]}
          </p>
        </div>

        {hasOutputs ? (
          <MeetingPlaybookOutputView playbookId={playbook.id} userId={user.id} outputs={playbook.generatedOutput} />
        ) : (
          <Card className="flex flex-col items-center gap-4 p-16 text-center">
            <p className="font-serif text-xl">Generation hasn't completed for this playbook</p>
            <p className="max-w-sm text-sm text-ink/60">
              This can happen if generation failed right after the playbook was created. Retry below.
            </p>
            <RetryMeetingPlaybookButton playbookId={playbook.id} />
          </Card>
        )}
      </main>
    </>
  );
}
