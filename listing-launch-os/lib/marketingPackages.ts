export type MarketingPackage = "essential_launch" | "premium_launch" | "signature_launch";

export const MARKETING_PACKAGE_LABELS: Record<MarketingPackage, string> = {
  essential_launch: "Essential Launch",
  premium_launch: "Premium Launch",
  signature_launch: "Signature Launch",
};

export interface MarketingPackageTemplate {
  key: MarketingPackage;
  label: string;
  inclusions: string[];
}

/**
 * Default NZ-style package templates. These are editable starting points for
 * the agent to present and customise with their own agency/provider —
 * never fixed promises or hardcoded prices.
 */
export const MARKETING_PACKAGES: MarketingPackageTemplate[] = [
  {
    key: "essential_launch",
    label: "Essential Launch",
    inclusions: [
      "Professional photography",
      "Floor plan",
      "Standard portal listing copy",
      "Basic social post",
      "Open-home post",
      "Buyer follow-up template",
    ],
  },
  {
    key: "premium_launch",
    label: "Premium Launch",
    inclusions: [
      "Professional photography",
      "Floor plan",
      "Aerial/drone photos if suitable",
      "Property video",
      "Premium portal copy",
      "Social captions",
      "Reel script",
      "Open-home sequence",
      "Vendor update template",
      "Buyer follow-up sequence",
    ],
  },
  {
    key: "signature_launch",
    label: "Signature Launch",
    inclusions: [
      "Photography",
      "Floor plan",
      "Aerial/drone photos if suitable",
      "Cinematic property video",
      "Agent reel / presenter video",
      "Twilight option if suitable",
      "Full campaign copy",
      "7-day campaign plan",
      "Open-home content",
      "Buyer follow-up",
      "Vendor update report",
      "SafeCheck review",
    ],
  },
];

export function marketingPackage(key: MarketingPackage): MarketingPackageTemplate {
  return MARKETING_PACKAGES.find((p) => p.key === key) || MARKETING_PACKAGES[0];
}
