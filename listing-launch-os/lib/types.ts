import type { MarketingPackage } from "./marketingPackages";
import type { PlanId } from "./plans";

export type TargetBuyer =
  | "first_home_buyer"
  | "family"
  | "investor"
  | "downsizer"
  | "luxury_buyer";

export type Tone =
  | "premium"
  | "warm_family"
  | "investor_focused"
  | "bold_social"
  | "simple_professional";

export type SaleMethod =
  | "auction"
  | "deadline_sale"
  | "price_by_negotiation"
  | "asking_price"
  | "tender"
  | "negotiation"
  | "other";

export type OwnershipType =
  | "freehold"
  | "cross_lease"
  | "unit_title"
  | "body_corporate"
  | "leasehold"
  | "unknown";

export const TARGET_BUYER_LABELS: Record<TargetBuyer, string> = {
  first_home_buyer: "First-home buyer",
  family: "Family",
  investor: "Investor",
  downsizer: "Downsizer",
  luxury_buyer: "Luxury buyer",
};

export const TONE_LABELS: Record<Tone, string> = {
  premium: "Premium",
  warm_family: "Warm family",
  investor_focused: "Investor-focused",
  bold_social: "Bold social",
  simple_professional: "Simple professional",
};

export const SALE_METHOD_LABELS: Record<SaleMethod, string> = {
  auction: "Auction",
  deadline_sale: "Deadline sale",
  price_by_negotiation: "Price by negotiation",
  asking_price: "Asking price",
  tender: "Tender",
  negotiation: "Negotiation",
  other: "Other",
};

export const OWNERSHIP_TYPE_LABELS: Record<OwnershipType, string> = {
  freehold: "Freehold",
  cross_lease: "Cross lease",
  unit_title: "Unit title",
  body_corporate: "Body corporate",
  leasehold: "Leasehold",
  unknown: "Unknown",
};

export interface PropertyDetails {
  address: string;
  suburb: string;
  propertyType: string;
  bedrooms?: number;
  bathrooms?: number;
  garages?: number;
  landSize?: string;
  floorArea?: string;
  keyFeatures?: string;
  renovations?: string;
  amenities?: string;
}

export interface CampaignInput extends PropertyDetails {
  targetBuyer: TargetBuyer;
  tone: Tone;
  cta?: string;
  notes?: string;
  agentName?: string;
  agencyName?: string;

  // NZ-specific fields
  saleMethod?: SaleMethod;
  ownershipType?: OwnershipType;
  schoolZoneNotes?: string;
  limBuildingReportNotes?: string;
  rentalYieldNotes?: string;
  wordsToAvoid?: string;
  openHomeDateTime?: string;
  agentPhone?: string;
  agentEmail?: string;
}

export interface Campaign extends CampaignInput {
  id: string;
  userId: string;
  status: "draft" | "generated" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface CampaignOutput {
  id: string;
  campaignId: string;
  sectionKey: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  userId: string;
  agentName?: string;
  agencyName?: string;
  phone?: string;
  defaultCta?: string;
  plan?: PlanId;
}

export interface BrandVoiceSettings {
  id: string;
  userId: string;
  defaultTone: Tone;
  signaturePhrases?: string;
  complianceNotes?: string;
}

// Raw DB row shapes (snake_case), used only at the supabase boundary.
export interface CampaignRow {
  id: string;
  user_id: string;
  address: string;
  suburb: string;
  property_type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  garages: number | null;
  land_size: string | null;
  floor_area: string | null;
  key_features: string | null;
  renovations: string | null;
  amenities: string | null;
  target_buyer: TargetBuyer;
  tone: Tone;
  cta: string | null;
  notes: string | null;
  agent_name: string | null;
  agency_name: string | null;
  sale_method: SaleMethod | null;
  ownership_type: OwnershipType | null;
  school_zone_notes: string | null;
  lim_building_report_notes: string | null;
  rental_yield_notes: string | null;
  words_to_avoid: string | null;
  open_home_date_time: string | null;
  agent_phone: string | null;
  agent_email: string | null;
  status: "draft" | "generated" | "archived";
  created_at: string;
  updated_at: string;
}

export interface CampaignOutputRow {
  id: string;
  campaign_id: string;
  user_id: string;
  section_key: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Vendor updates — "Manage the Campaign" module
// ---------------------------------------------------------------------------

export type VendorUpdateType =
  | "post_open_home"
  | "weekly_update"
  | "price_feedback"
  | "low_enquiry_update"
  | "offer_update";

export const VENDOR_UPDATE_TYPE_LABELS: Record<VendorUpdateType, string> = {
  post_open_home: "Post-open-home",
  weekly_update: "Weekly update",
  price_feedback: "Price feedback",
  low_enquiry_update: "Low enquiry update",
  offer_update: "Offer update",
};

export type VendorUpdateTone = "confident" | "warm" | "direct" | "careful" | "premium";

export const VENDOR_UPDATE_TONE_LABELS: Record<VendorUpdateTone, string> = {
  confident: "Confident",
  warm: "Warm",
  direct: "Direct",
  careful: "Careful",
  premium: "Premium",
};

export interface VendorUpdateFormData {
  updateType: VendorUpdateType;
  enquiries?: number;
  openHomeGroups?: number;
  buyerFeedbackSummary?: string;
  positiveFeedback?: string;
  concerns?: string;
  priceFeedback?: string;
  offersOrInterest?: string;
  onlineViews?: string;
  socialActivity?: string;
  recommendedNextStep?: string;
  agentNotes?: string;
  tone: VendorUpdateTone;
}

/** Everything a vendor update prompt/template needs: the form data plus the property/agent context pulled from the parent campaign. */
export interface VendorUpdateContext extends VendorUpdateFormData {
  address: string;
  suburb: string;
  propertyType: string;
  agentName?: string;
  agencyName?: string;
  agentPhone?: string;
  agentEmail?: string;
}

export interface VendorUpdate {
  id: string;
  userId: string;
  campaignId: string;
  updateType: VendorUpdateType;
  formData: VendorUpdateFormData;
  generatedOutput: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface VendorUpdateRow {
  id: string;
  user_id: string;
  campaign_id: string;
  update_type: VendorUpdateType;
  form_data: VendorUpdateFormData;
  generated_output: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export function vendorUpdateFromRow(row: VendorUpdateRow): VendorUpdate {
  return {
    id: row.id,
    userId: row.user_id,
    campaignId: row.campaign_id,
    updateType: row.update_type,
    formData: row.form_data || ({} as VendorUpdateFormData),
    generatedOutput: row.generated_output || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Agent Meeting Playbook — "Win the Listing" module
// ---------------------------------------------------------------------------

export type MeetingType =
  | "appraisal"
  | "vendor_pitch"
  | "listing_presentation"
  | "marketing_review"
  | "price_feedback_meeting"
  | "pre_auction_meeting"
  | "post_open_home_review";

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  appraisal: "Appraisal",
  vendor_pitch: "Vendor pitch",
  listing_presentation: "Listing presentation",
  marketing_review: "Marketing review",
  price_feedback_meeting: "Price feedback meeting",
  pre_auction_meeting: "Pre-auction meeting",
  post_open_home_review: "Post-open-home review",
};

export type MeetingSaleMethod =
  | "auction"
  | "deadline_sale"
  | "price_by_negotiation"
  | "asking_price"
  | "tender"
  | "negotiation"
  | "unknown";

export const MEETING_SALE_METHOD_LABELS: Record<MeetingSaleMethod, string> = {
  auction: "Auction",
  deadline_sale: "Deadline sale",
  price_by_negotiation: "Price by negotiation",
  asking_price: "Asking price",
  tender: "Tender",
  negotiation: "Negotiation",
  unknown: "Unknown / to be discussed",
};

export type VendorMotivation =
  | "upsizing"
  | "downsizing"
  | "relocating"
  | "investor_sale"
  | "deceased_estate"
  | "separation"
  | "financial_pressure"
  | "testing_market"
  | "other"
  | "unknown";

export const VENDOR_MOTIVATION_LABELS: Record<VendorMotivation, string> = {
  upsizing: "Upsizing",
  downsizing: "Downsizing",
  relocating: "Relocating",
  investor_sale: "Investor sale",
  deceased_estate: "Deceased estate",
  separation: "Separation",
  financial_pressure: "Financial pressure",
  testing_market: "Testing the market",
  other: "Other",
  unknown: "Unknown",
};

export type VendorPriority =
  | "highest_price"
  | "fastest_sale"
  | "low_stress"
  | "privacy"
  | "premium_marketing"
  | "low_upfront_cost"
  | "certainty"
  | "other";

export const VENDOR_PRIORITY_LABELS: Record<VendorPriority, string> = {
  highest_price: "Highest price",
  fastest_sale: "Fastest sale",
  low_stress: "Low stress",
  privacy: "Privacy",
  premium_marketing: "Premium marketing",
  low_upfront_cost: "Low upfront cost",
  certainty: "Certainty",
  other: "Other",
};

export type VendorConcern =
  | "commission"
  | "marketing_cost"
  | "timing"
  | "privacy"
  | "market_conditions"
  | "property_condition"
  | "tenant_access"
  | "buyer_interest"
  | "price_expectation"
  | "previous_failed_campaign"
  | "other";

export const VENDOR_CONCERN_LABELS: Record<VendorConcern, string> = {
  commission: "Commission",
  marketing_cost: "Marketing cost",
  timing: "Timing",
  privacy: "Privacy",
  market_conditions: "Market conditions",
  property_condition: "Property condition",
  tenant_access: "Tenant access",
  buyer_interest: "Buyer interest",
  price_expectation: "Price expectation",
  previous_failed_campaign: "Previous failed campaign",
  other: "Other",
};

export type VendorPersonality =
  | "analytical"
  | "emotional"
  | "time_poor"
  | "price_sensitive"
  | "premium_focused"
  | "cautious"
  | "direct"
  | "relationship_focused";

export const VENDOR_PERSONALITY_LABELS: Record<VendorPersonality, string> = {
  analytical: "Analytical",
  emotional: "Emotional",
  time_poor: "Time-poor",
  price_sensitive: "Price-sensitive",
  premium_focused: "Premium-focused",
  cautious: "Cautious",
  direct: "Direct",
  relationship_focused: "Relationship-focused",
};

export type MeetingTone = "professional" | "premium" | "warm" | "direct" | "confident" | "consultative";

export const MEETING_TONE_LABELS: Record<MeetingTone, string> = {
  professional: "Professional",
  premium: "Premium",
  warm: "Warm",
  direct: "Direct",
  confident: "Confident",
  consultative: "Consultative",
};

export interface AgentMeetingPlaybookFormData {
  // Meeting details
  meetingType: MeetingType;
  propertyAddress: string;
  suburb: string;
  propertyType: string;
  estimatedValueRange?: string;
  saleMethod?: MeetingSaleMethod;
  meetingDateTime?: string;
  vendorName?: string;

  // Vendor situation
  vendorMotivation?: VendorMotivation;
  vendorPriority?: VendorPriority;
  vendorConcerns?: VendorConcern[];
  vendorPersonality?: VendorPersonality;

  // Property context
  keyStrengths?: string;
  knownWeaknesses?: string;
  renovations?: string;
  amenities?: string;
  schoolZoneNotes?: string;
  limBuildingReportNotes?: string;
  disclosureItems?: string;
  claimsToVerify?: string;

  // Agent positioning
  agentName?: string;
  agencyName?: string;
  agentPhone?: string;
  agentEmail?: string;
  agentStrengths?: string;
  recentSales?: string;
  testimonials?: string;
  whyChooseAgent?: string;
  tone: MeetingTone;

  // Marketing package advisor
  preferredPackage?: MarketingPackage;
  photographyCost?: string;
  videoCost?: string;
  floorPlanCost?: string;
  droneCost?: string;
  twilightCost?: string;
  portalUpgradeCost?: string;
  socialAdBudget?: string;
  printSignageCost?: string;
  totalBudget?: string;
}

export interface AgentMeetingPlaybook {
  id: string;
  userId: string;
  campaignId?: string;
  meetingType: MeetingType;
  propertyAddress: string;
  suburb: string;
  formData: AgentMeetingPlaybookFormData;
  generatedOutput: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentMeetingPlaybookRow {
  id: string;
  user_id: string;
  campaign_id: string | null;
  meeting_type: MeetingType;
  property_address: string;
  suburb: string;
  form_data: AgentMeetingPlaybookFormData;
  generated_output: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export function agentMeetingPlaybookFromRow(row: AgentMeetingPlaybookRow): AgentMeetingPlaybook {
  return {
    id: row.id,
    userId: row.user_id,
    campaignId: row.campaign_id ?? undefined,
    meetingType: row.meeting_type,
    propertyAddress: row.property_address,
    suburb: row.suburb,
    formData: row.form_data || ({} as AgentMeetingPlaybookFormData),
    generatedOutput: row.generated_output || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function campaignFromRow(row: CampaignRow): Campaign {
  return {
    id: row.id,
    userId: row.user_id,
    address: row.address,
    suburb: row.suburb,
    propertyType: row.property_type,
    bedrooms: row.bedrooms ?? undefined,
    bathrooms: row.bathrooms ?? undefined,
    garages: row.garages ?? undefined,
    landSize: row.land_size ?? undefined,
    floorArea: row.floor_area ?? undefined,
    keyFeatures: row.key_features ?? undefined,
    renovations: row.renovations ?? undefined,
    amenities: row.amenities ?? undefined,
    targetBuyer: row.target_buyer,
    tone: row.tone,
    cta: row.cta ?? undefined,
    notes: row.notes ?? undefined,
    agentName: row.agent_name ?? undefined,
    agencyName: row.agency_name ?? undefined,
    saleMethod: row.sale_method ?? undefined,
    ownershipType: row.ownership_type ?? undefined,
    schoolZoneNotes: row.school_zone_notes ?? undefined,
    limBuildingReportNotes: row.lim_building_report_notes ?? undefined,
    rentalYieldNotes: row.rental_yield_notes ?? undefined,
    wordsToAvoid: row.words_to_avoid ?? undefined,
    openHomeDateTime: row.open_home_date_time ?? undefined,
    agentPhone: row.agent_phone ?? undefined,
    agentEmail: row.agent_email ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
