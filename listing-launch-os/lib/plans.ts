// Stripe billing will be added later. For MVP, plan access is manual/simulated
// (see the "Plan" field in Settings) — there is no checkout, subscription
// billing, or payment processing here yet.

export type PlanId = "free" | "starter" | "pro" | "growth";

export const PLAN_IDS: PlanId[] = ["free", "starter", "pro", "growth"];

/** Gated modules — used to lock whole pages/features behind a plan. */
export type PlanModule = "meeting_playbook" | "vendor_update_report";

export type CampaignLimitPeriod = "lifetime" | "month";

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number;
  purpose: string;
  campaignLimit: number;
  campaignLimitPeriod: CampaignLimitPeriod;
  campaignLimitLabel: string;
  features: string[];
  lockedFeatures: string[];
  modules: PlanModule[];
  recommended: boolean;
  ctaLabel: string;
  planNote: string;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    purpose: "Let agents experience the value with one real property before subscribing.",
    campaignLimit: 1,
    campaignLimitPeriod: "lifetime",
    campaignLimitLabel: "1 campaign pack total",
    features: ["Portal Copy", "Social Posts", "Reel Hooks/Scripts", "Campaign Timeline", "Basic SafeCheck", "Copy buttons"],
    lockedFeatures: [
      "Agent Meeting Playbook",
      "Vendor Update Reports",
      "Open Home Debrief",
      "Buyer Follow-Up Assistant",
      "Saved Brand Voice",
      "Listing Health Score",
      "Advanced regenerations",
      "Team features",
      "PDF/export",
      "Direct platform integrations",
    ],
    modules: [],
    recommended: false,
    ctaLabel: "Start Free",
    planNote: "Create your first campaign pack free. No credit card required.",
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceMonthly: 49,
    purpose: "For new or occasional agents who want simple launch support.",
    campaignLimit: 5,
    campaignLimitPeriod: "month",
    campaignLimitLabel: "5 listing campaigns/month",
    features: [
      "Everything in Free",
      "Full Launch Pack",
      "Portal Copy",
      "Social Posts",
      "Reels & Video",
      "Open Home Content",
      "Email & Follow-up",
      "Vendor update copy inside the launch pack",
      "Campaign Timeline",
      "Full SafeCheck",
      "Saved campaigns",
      "Copy/edit/save outputs",
    ],
    lockedFeatures: [
      "Agent Meeting Playbook",
      "Vendor Update Report module",
      "Open Home Debrief module",
      "Buyer Follow-Up Assistant module",
      "Listing Health Score",
      "Team features",
    ],
    modules: [],
    recommended: false,
    ctaLabel: "Choose Starter",
    planNote: "For agents who want a faster, cleaner listing launch workflow.",
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 149,
    purpose: "Main recommended plan for active agents.",
    campaignLimit: 15,
    campaignLimitPeriod: "month",
    campaignLimitLabel: "15 listing campaigns/month",
    features: [
      "Everything in Starter",
      "Agent Meeting Playbook",
      "Vendor Update Reports",
      "Open Home Debrief",
      "Buyer Follow-Up Assistant",
      "Brand Voice/Profile",
      "Marketing package recommendations",
      "Objection handling scripts",
      "Better campaign refresh ideas",
      "Priority template updates",
    ],
    lockedFeatures: [],
    modules: ["meeting_playbook", "vendor_update_report"],
    recommended: true,
    ctaLabel: "Go Pro",
    planNote: "Best for agents who want help winning, launching, and managing listings.",
  },
  growth: {
    id: "growth",
    name: "Growth",
    priceMonthly: 299,
    purpose: "For top agents and small teams.",
    campaignLimit: 40,
    campaignLimitPeriod: "month",
    campaignLimitLabel: "40 listing campaigns/month",
    features: [
      "Everything in Pro",
      "Listing Health Score",
      "Vendor Proposal Kit",
      "Prospecting Content Engine",
      "Team/assistant workflow (placeholder)",
      "Custom agency tone/templates (placeholder)",
      "Advanced reporting (placeholder)",
      "Priority support (placeholder)",
    ],
    lockedFeatures: [],
    modules: ["meeting_playbook", "vendor_update_report"],
    recommended: false,
    ctaLabel: "Choose Growth",
    planNote: "For serious agents and small teams who want a full listing lifecycle system.",
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "starter", "pro", "growth"];

export function getPlan(id: string | null | undefined): Plan {
  return PLANS[(id as PlanId) in PLANS ? (id as PlanId) : "free"];
}

export function planHasModule(id: string | null | undefined, moduleKey: PlanModule): boolean {
  return getPlan(id).modules.includes(moduleKey);
}

/** Free plan is capped at one campaign pack ever; paid plans aren't enforced yet (no billing/usage tracking) — this is placeholder access logic only. */
export function hasReachedCampaignLimit(planId: string | null | undefined, campaignCount: number): boolean {
  const plan = getPlan(planId);
  if (plan.id !== "free") return false;
  return campaignCount >= plan.campaignLimit;
}
