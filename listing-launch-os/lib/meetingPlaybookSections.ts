export interface MeetingPlaybookSectionMeta {
  key: string;
  label: string;
}

export const MEETING_PLAYBOOK_SECTIONS: MeetingPlaybookSectionMeta[] = [
  { key: "meeting_checklist", label: "Meeting Checklist" },
  { key: "what_to_say", label: "What to Say" },
  { key: "questions_to_ask", label: "Questions to Ask Vendor" },
  { key: "package_recommendation", label: "Marketing Package Recommendation" },
  { key: "cost_explanation", label: "Cost Explanation Script" },
  { key: "objection_handling", label: "Objection Handling" },
  { key: "compliance_notes", label: "Compliance / SafeCheck Notes" },
  { key: "followup_pack", label: "Follow-Up Pack" },
  { key: "seven_day_plan", label: "7-Day Win-the-Listing Plan" },
];

export const MEETING_PLAYBOOK_SECTION_KEYS = MEETING_PLAYBOOK_SECTIONS.map((s) => s.key);

export function meetingPlaybookSectionMeta(key: string): MeetingPlaybookSectionMeta | undefined {
  return MEETING_PLAYBOOK_SECTIONS.find((s) => s.key === key);
}
