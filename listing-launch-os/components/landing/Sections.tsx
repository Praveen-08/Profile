import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TAB_LABELS, TAB_ORDER, sectionsForTab } from "@/lib/sections";
import { PLANS, PLAN_ORDER } from "@/lib/plans";

export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pt-24">
      <div className="mx-auto max-w-3xl text-center">
        <Badge>Built for NZ agents</Badge>
        <h1 className="mt-6 font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
          One property form. Every listing campaign asset.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base font-medium text-gold-dark">
          Now built around the full listing lifecycle: win the listing, launch the campaign, and manage vendor
          communication.
        </p>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-ink/60">
          Enter a property's details once. Get a complete Listing Launch Pack — descriptions, social captions, reel
          scripts, vendor updates, open-home posts, a 7-day plan, and a built-in SafeCheck review — ready to copy,
          edit and publish.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button href="/login" size="lg">
            Create your first launch pack
          </Button>
          <Button href="#product-preview" variant="outline" size="lg">
            View Sample Campaign
          </Button>
        </div>
      </div>
    </section>
  );
}

const LIFECYCLE_MODULES = [
  {
    title: "Win the Listing",
    body: "Meeting playbooks, vendor questions, marketing package recommendations, objection handling.",
  },
  {
    title: "Launch the Listing",
    body: "Portal copy, social posts, reels, open-home content, campaign timeline.",
  },
  {
    title: "Manage the Campaign",
    body: "Vendor updates, open-home debriefs, buyer follow-ups, SafeCheck.",
  },
];

export function MoreThanListingCopy() {
  return (
    <section className="border-y border-ink/10 bg-white py-16">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-center font-serif text-2xl sm:text-3xl">More than listing copy</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {LIFECYCLE_MODULES.map((m) => (
            <Card key={m.title} className="p-6">
              <h3 className="font-medium">{m.title}</h3>
              <p className="mt-2 text-sm text-ink/60">{m.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ProblemSection() {
  return (
    <section className="border-y border-ink/10 bg-white py-16">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <h2 className="font-serif text-2xl sm:text-3xl">Every listing needs a dozen pieces of copy.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-ink/60">
          Property description, Trade Me copy, Instagram captions, reel scripts, an open-home post, a vendor
          update — most agents either spend hours writing it themselves or skip half of it. Listing Launch
          builds the whole campaign from one form.
        </p>
      </div>
    </section>
  );
}

const STEPS = [
  { title: "Enter listing details", body: "Address, features, target buyer and tone — one guided form, a few minutes." },
  { title: "Generate the launch pack", body: "Every section is written specifically for this property, not generic filler." },
  { title: "Copy, edit, publish", body: "Copy each section, tweak the wording, export the pack, and launch the campaign." },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <h2 className="text-center font-serif text-2xl sm:text-3xl">How it works</h2>
      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <Card key={step.title} className="p-6">
            <div className="mb-3 font-serif text-3xl text-gold-dark">{i + 1}</div>
            <h3 className="font-medium">{step.title}</h3>
            <p className="mt-2 text-sm text-ink/60">{step.body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

const SAFECHECK_HIGHLIGHTS = [
  "Flags risky NZ real estate wording before you publish",
  "Guaranteed returns, unverified building claims, unsupported superlatives",
  "Risk level, plain-English reason, and safer rewording for every flag",
];

export function PackContents() {
  return (
    <section id="pack-contents" className="border-y border-ink/10 bg-white py-16">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-center font-serif text-2xl sm:text-3xl">What's in every Listing Launch Pack</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-ink/60">
          A complete campaign pack, organised into practical tabs, generated from one property form.
        </p>
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {TAB_ORDER.map((tab) => (
            <div key={tab}>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gold-dark">
                {TAB_LABELS[tab]}
              </h3>
              <ul className="space-y-2 text-sm text-ink/70">
                {(tab === "safecheck" ? SAFECHECK_HIGHLIGHTS : sectionsForTab(tab).map((s) => s.label)).map(
                  (label) => (
                    <li key={label}>{label}</li>
                  )
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const BENEFITS = [
  { title: "Hours back every week", body: "Stop starting from a blank page for every new listing." },
  { title: "Consistent quality", body: "Every campaign gets the full treatment, not just whatever you have time for." },
  { title: "On-brand every time", body: "Save your agent name, agency and preferred tone once, reuse it on every campaign." },
  { title: "NZ-specific", body: "Written in NZ English, for Trade Me and realestate.co.nz conventions, with compliant wording." },
];

export function Benefits() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <h2 className="text-center font-serif text-2xl sm:text-3xl">Why agents use it</h2>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {BENEFITS.map((b) => (
          <div key={b.title}>
            <h3 className="font-medium">{b.title}</h3>
            <p className="mt-2 text-sm text-ink/60">{b.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const WHO_ITS_FOR = [
  { title: "New agents", body: "Who need to look professional fast, without a marketing background." },
  { title: "Busy agents", body: "Launching multiple listings at once and need every campaign to get the full treatment." },
  { title: "Small teams", body: "Without a full in-house marketing department to lean on." },
  { title: "Real estate media businesses", body: "Offering campaign copy as an add-on alongside photography and video." },
];

export function WhoItsFor() {
  return (
    <section className="border-y border-ink/10 bg-white py-16">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center font-serif text-2xl sm:text-3xl">Who it's for</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {WHO_ITS_FOR.map((w) => (
            <Card key={w.title} className="p-6">
              <h3 className="font-medium">{w.title}</h3>
              <p className="mt-2 text-sm text-ink/60">{w.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ExamplePreview() {
  return (
    <section className="border-y border-ink/10 bg-white py-16">
      <div className="mx-auto max-w-3xl px-6">
        <h2 className="text-center font-serif text-2xl sm:text-3xl">SafeCheck example</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-ink/60">
          Every generated section is reviewed for risky NZ real estate wording before you publish it.
        </p>
        <Card className="mt-8 border-red-200 bg-red-50/40 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink">"Guaranteed return"</p>
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-red-700">
              High risk
            </span>
          </div>
          <p className="mt-3 text-sm text-ink/70">
            <span className="font-medium text-ink/70">Why it matters: </span>
            This may imply a financial outcome that cannot be guaranteed.
          </p>
          <p className="mt-2 text-sm text-ink/70">
            <span className="font-medium text-ink/70">Safer wording: </span>
            "Potential rental appeal for buyers seeking an investment-style property, subject to their own due
            diligence."
          </p>
        </Card>
        <p className="mx-auto mt-4 max-w-xl text-center text-xs text-ink/40">
          Review all copy before publishing. The agent remains responsible for accuracy. This is a marketing
          review assistant, not legal advice.
        </p>
      </div>
    </section>
  );
}

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-16">
      <h2 className="text-center font-serif text-2xl sm:text-3xl">Pricing</h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-ink/60">
        Early access is open while we test with NZ agents.
      </p>
      <Card className="mx-auto mt-6 max-w-xl border-gold/40 bg-gold/5 p-4 text-center text-sm text-ink/70">
        Try Listing Launch with one real property. Create your first campaign pack free — no credit card required.
      </Card>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {PLAN_ORDER.map((planId) => {
          const plan = PLANS[planId];
          return (
            <Card
              key={plan.id}
              className={`flex flex-col p-6 ${plan.recommended ? "border-gold ring-1 ring-gold" : ""}`}
            >
              {plan.recommended && <Badge className="mb-3 self-start">Recommended</Badge>}
              <h3 className="font-serif text-xl">{plan.name}</h3>
              <p className="mt-2">
                <span className="font-serif text-3xl">{plan.priceMonthly === 0 ? "$0" : `$${plan.priceMonthly}`}</span>
                {plan.priceMonthly > 0 && <span className="text-ink/50">/month</span>}
              </p>
              <p className="mt-2 text-sm text-ink/60">{plan.purpose}</p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-gold-dark">
                {plan.campaignLimitLabel}
              </p>

              <ul className="mt-4 space-y-1.5 text-sm text-ink/70">
                {plan.features.slice(0, 4).map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>

              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-gold-dark">See full plan details</summary>
                <ul className="mt-2 space-y-1.5 text-ink/70">
                  {plan.features.map((f) => (
                    <li key={f}>· {f}</li>
                  ))}
                </ul>
                {plan.lockedFeatures.length > 0 && (
                  <>
                    <p className="mt-3 text-xs font-medium uppercase tracking-wide text-ink/40">Does not include</p>
                    <ul className="mt-1.5 space-y-1.5 text-ink/50">
                      {plan.lockedFeatures.map((f) => (
                        <li key={f}>· {f}</li>
                      ))}
                    </ul>
                  </>
                )}
              </details>

              <p className="mt-4 flex-1 text-xs text-ink/50">{plan.planNote}</p>

              <Button href="/login" variant={plan.recommended ? "primary" : "outline"} className="mt-6 w-full">
                {plan.ctaLabel}
              </Button>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

export function CTASection() {
  return (
    <section className="border-t border-ink/10 bg-ink py-16 text-paper">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <h2 className="font-serif text-2xl sm:text-3xl">Ready to launch your next listing?</h2>
        <p className="mt-3 text-paper/70">Create an account and generate your first Listing Launch Pack for free.</p>
        <Button href="/login" variant="secondary" size="lg" className="mt-8">
          Get started
        </Button>
      </div>
    </section>
  );
}
