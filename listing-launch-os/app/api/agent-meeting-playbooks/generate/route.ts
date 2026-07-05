import { generateMeetingPlaybookSections } from "@/lib/ai/generate";
import { MEETING_PLAYBOOK_SECTION_KEYS } from "@/lib/meetingPlaybookSections";
import { createClient } from "@/lib/supabase/server";
import { agentMeetingPlaybookFromRow, type AgentMeetingPlaybookRow } from "@/lib/types";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const playbookId: string | undefined = body?.playbookId;
  const requestedSections: string[] | undefined = body?.sections;

  if (!playbookId) {
    return NextResponse.json({ error: "playbookId is required." }, { status: 400 });
  }

  // Explicit user_id filter in addition to RLS.
  const { data: row, error: fetchError } = await supabase
    .from("agent_meeting_playbooks")
    .select("*")
    .eq("id", playbookId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !row) {
    return NextResponse.json({ error: "Meeting playbook not found." }, { status: 404 });
  }

  const playbook = agentMeetingPlaybookFromRow(row as AgentMeetingPlaybookRow);

  const sectionKeys = requestedSections?.length
    ? requestedSections.filter((key) => MEETING_PLAYBOOK_SECTION_KEYS.includes(key))
    : MEETING_PLAYBOOK_SECTION_KEYS;

  if (sectionKeys.length === 0) {
    return NextResponse.json({ error: "No valid sections requested." }, { status: 400 });
  }

  let generated: Record<string, string>;
  try {
    generated = await generateMeetingPlaybookSections(sectionKeys, playbook.formData);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const mergedOutput = { ...playbook.generatedOutput, ...generated };

  const { error: updateError } = await supabase
    .from("agent_meeting_playbooks")
    .update({ generated_output: mergedOutput })
    .eq("id", playbookId)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ outputs: generated });
}
