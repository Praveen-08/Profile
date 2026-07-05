import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CATEGORY_LABELS, SECTIONS } from "@/lib/sections";

export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pt-24">
      <div className="mx-auto max-w-3xl text-center">
        <Badge>Built for Auckland &amp; NZ agents</Badge>
        <h1 className="mt-6 font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
          Launch every listing like a full marketing campaign — in minutes, not hours.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-ink/60">
          Enter a property's details once. Get a complete Listing Launch Pack — descriptions, social captions, reel
          scripts, vendor updates, open-home posts and a 7-day plan — ready to copy, edit and publish.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button href="/login" size="lg">
            Create your first launch pack
          </Button>
          <Button href="#pack-contents" variant="outline" size="lg">
            See what's included
          </Button>
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
          Property description, TradeMe copy, Instagram captions, reel scripts, an open-home post, a vendor
          update — most agents either spend hours writing it themselves or skip half of it. Listing Launch OS
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

export function PackContents() {
  const grouped = SECTIONS.reduce<Record<string, string[]>>((acc, s) => {
    acc[s.category] = acc[s.category] || [];
    acc[s.category].push(s.label);
    return acc;
  }, {});

  return (
    <section id="pack-contents" className="border-y border-ink/10 bg-white py-16">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-center font-serif text-2xl sm:text-3xl">What's in every Listing Launch Pack</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-ink/60">
          {SECTIONS.length} pieces of campaign-ready content, generated together from one property form.
        </p>
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(grouped).map(([category, labels]) => (
            <div key={category}>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gold-dark">
                {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
              </h3>
              <ul className="space-y-2 text-sm text-ink/70">
                {labels.map((label) => (
                  <li key={label}>{label}</li>
                ))}
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
  { title: "NZ-specific", body: "Written in NZ English, for TradeMe and realestate.co.nz conventions, with compliant wording." },
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

export function ExamplePreview() {
  return (
    <section className="border-y border-ink/10 bg-white py-16">
      <div className="mx-auto max-w-3xl px-6">
        <h2 className="text-center font-serif text-2xl sm:text-3xl">Example output</h2>
        <Card className="mt-8 p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-gold-dark">Premium listing description</p>
          <p className="mt-3 text-sm leading-relaxed text-ink/80">
            Positioned in Mount Eden, this 3-bedroom, 2-bathroom home at 14 Fenwick Avenue presents a practical,
            comfortable home for family life. Featuring 3 bedrooms, 2 bathrooms, 2 car parks, approximately 450m²
            land, the home offers a considered layout suited to everyday living. Highlights include renovated
            kitchen, north-facing living, and off-street parking.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-ink/80">
            Approximately 450m² of land and approximately 180m² floor area give a sense of scale, while the Mount
            Eden location adds everyday convenience. Contact us today to arrange a viewing.
          </p>
        </Card>
      </div>
    </section>
  );
}

const PLANS = [
  { name: "Starter", price: "$29", period: "/month", campaigns: "10 campaigns / month" },
  { name: "Pro", price: "$79", period: "/month", campaigns: "40 campaigns / month", featured: true },
  { name: "Team", price: "$149", period: "/month", campaigns: "100 campaigns / month" },
];

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-16">
      <h2 className="text-center font-serif text-2xl sm:text-3xl">Pricing</h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-ink/60">
        Payment is coming soon — for now, get in touch for early access.
      </p>
      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <Card
            key={plan.name}
            className={`p-6 ${plan.featured ? "border-gold ring-1 ring-gold" : ""}`}
          >
            {plan.featured && <Badge className="mb-3">Most popular</Badge>}
            <h3 className="font-serif text-xl">{plan.name}</h3>
            <p className="mt-2">
              <span className="font-serif text-3xl">{plan.price}</span>
              <span className="text-ink/50">{plan.period}</span>
            </p>
            <p className="mt-2 text-sm text-ink/60">{plan.campaigns}</p>
            <Button href="/login" variant={plan.featured ? "primary" : "outline"} className="mt-6 w-full">
              Coming soon
            </Button>
          </Card>
        ))}
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
