import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { ProductPreview } from "@/components/landing/ProductPreview";
import {
  Hero,
  ProblemSection,
  HowItWorks,
  PackContents,
  WhoItsFor,
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
        <ProductPreview />
        <ProblemSection />
        <HowItWorks />
        <PackContents />
        <WhoItsFor />
        <Benefits />
        <ExamplePreview />
        <Pricing />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
