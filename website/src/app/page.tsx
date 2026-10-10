import Chrome from '@/components/Chrome';
import Cta from '@/components/Cta';
import DepositSim from '@/components/DepositSim';
import Faq from '@/components/Faq';
import Features from '@/components/Features';
import Footer from '@/components/Footer';
import Hero from '@/components/Hero';
import HowItWorks from '@/components/HowItWorks';
import Marquee from '@/components/Marquee';
import Nav from '@/components/Nav';
import Problem from '@/components/Problem';
import ThemeFan from '@/components/ThemeFan';

export default function Home() {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <Marquee />
        <Problem />
        <HowItWorks />
        <DepositSim />
        <Features />
        <ThemeFan />
        <Faq />
        <Cta />
      </main>
      <Footer />
      {/* Last, so its global effects (smooth scroll, reveals) run after every section has set up */}
      <Chrome />
    </>
  );
}
