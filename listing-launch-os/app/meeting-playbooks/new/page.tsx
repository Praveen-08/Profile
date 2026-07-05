import { AppNav } from "@/components/app/AppNav";
import { MeetingPlaybookForm } from "@/components/meeting-playbook/MeetingPlaybookForm";
import { createClient } from "@/lib/supabase/server";

export default async function NewMeetingPlaybookPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle()
    : { data: null };

  return (
    <>
      <AppNav active="meeting-playbooks" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-serif text-2xl">Create meeting playbook</h1>
        <p className="mt-1 text-sm text-ink/60">
          Prepare for an appraisal, vendor pitch, or listing presentation — enter what you know, and leave the rest
          general rather than guessing.
        </p>
        <div className="mt-8">
          <MeetingPlaybookForm
            defaults={{
              agentName: profile?.agent_name || undefined,
              agencyName: profile?.agency_name || undefined,
              agentPhone: profile?.phone || undefined,
              agentEmail: user?.email || undefined,
            }}
          />
        </div>
      </main>
    </>
  );
}
