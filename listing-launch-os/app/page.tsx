import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import {
  Hero,
  ProblemSection,
  HowItWorks,
  PackContents,
  Benefits,
  ExamplePreview,
  Pricing,
  CTASection,
} from "@/components/landing/Sections";

export default function LandingPage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <ProblemSection />
        <HowItWorks />
        <PackContents />
        <Benefits />
        <ExamplePreview />
        <Pricing />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
