# Sales

## Current flow
`book.html` is the enquiry form: property/campaign details → package selection (dropdown
includes "Signature Package" etc.) → submit → `thank-you.html`. This is manual/email-driven, not
automated end-to-end yet.

## Roadmap's automation target (Phase 4, "Book Shoot" button)
```
Create Calendar Event → Create Folder → Send Client Email → Notify Editor →
Weather Check → Drone Check → Sun Position → Travel Time → Invoice Draft
```
None of this is implemented yet in this repo — `book.html` submission doesn't appear to trigger
any of these automatically. This is a concrete Stage 1 ("PK OS") build target.

## Sales GPT concept (from roadmap)
Knows: pricing, packages, objections, offers, upsells, follow-ups. Feed it `Brand/Pricing.md`,
`Brand/Packages.md`, and this file once real objection-handling notes exist.
