import { describe, expect, it } from "vitest";
import { StyleConfigSchema } from "@quickreel/shared";
import { STYLE_CATALOG, getStyleBySlug } from "./catalog.js";

describe("style catalog", () => {
  it("has exactly 17 styles", () => {
    expect(STYLE_CATALOG).toHaveLength(17);
  });

  it("has unique slugs", () => {
    const slugs = STYLE_CATALOG.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every style validates against StyleConfigSchema", () => {
    for (const s of STYLE_CATALOG) {
      expect(() => StyleConfigSchema.parse(s)).not.toThrow();
    }
  });

  it("getStyleBySlug resolves a known style", () => {
    expect(getStyleBySlug("luxury-cinematic")?.name).toBe("Luxury Cinematic");
    expect(getStyleBySlug("does-not-exist")).toBeUndefined();
  });
});
