import type { VendorUpdateFormData } from "./types";

export interface VendorUpdateSectionMeta {
  key: string;
  label: string;
}

export const VENDOR_UPDATE_SECTIONS: VendorUpdateSectionMeta[] = [
  { key: "vendor_update_email", label: "Vendor update email" },
  { key: "sms_update", label: "Short SMS / WhatsApp update" },
  { key: "what_we_learned", label: "What we learned" },
  { key: "buyer_feedback_summary", label: "Buyer feedback summary" },
  { key: "recommended_next_steps", label: "Recommended next steps" },
  { key: "price_feedback_wording", label: "Price feedback wording" },
  { key: "next_7day_actions", label: "Next 7-day campaign actions" },
];

export const VENDOR_UPDATE_SECTION_KEYS = VENDOR_UPDATE_SECTIONS.map((s) => s.key);

export function vendorUpdateSectionMeta(key: string): VendorUpdateSectionMeta | undefined {
  return VENDOR_UPDATE_SECTIONS.find((s) => s.key === key);
}

/**
 * "price_feedback_wording" is only generated when price feedback is actually
 * relevant — otherwise there's nothing honest to say and the section would
 * just invent filler.
 */
export function sectionsToGenerate(formData: Pick<VendorUpdateFormData, "updateType" | "priceFeedback">): string[] {
  const priceRelevant = formData.updateType === "price_feedback" || !!formData.priceFeedback;
  return priceRelevant
    ? VENDOR_UPDATE_SECTION_KEYS
    : VENDOR_UPDATE_SECTION_KEYS.filter((key) => key !== "price_feedback_wording");
}
