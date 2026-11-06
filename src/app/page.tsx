import { Footer } from "@/components/Footer";
import { Cinematic } from "@/components/landing/Cinematic";
import {
  FAQSection,
  FeaturesSection,
  ForVenuesSection,
  HighlightsSection,
  PlansSection,
  SportsSection,
  VenueDiscovery,
} from "@/components/landing/Sections";

export default function Home() {
  return (
    <>
      <main id="main">
        <Cinematic>
          <SportsSection />
          <FeaturesSection />
          <VenueDiscovery />
          <HighlightsSection />
          <ForVenuesSection />
          <PlansSection />
          <FAQSection />
        </Cinematic>
      </main>
      <Footer />
    </>
  );
}
