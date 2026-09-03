import routeIcon from "../../assets/icons/route.svg?raw";
import databaseIcon from "../../assets/icons/database.svg?raw";
import gridIcon from "../../assets/icons/grid.svg?raw";
import devicePhoneIcon from "../../assets/icons/device-phone.svg?raw";
import serverStackIcon from "../../assets/icons/server-stack.svg?raw";
import cloudIcon from "../../assets/icons/cloud.svg?raw";
import settingsIcon from "../../assets/icons/settings.svg?raw";
import cpuIcon from "../../assets/icons/cpu.svg?raw";
import { useEffect, useRef, useState } from "react";
import { Brand } from "../components/Brand";
import { InteractiveQuestion } from "../components/InteractiveQuestion";
import { Reveal } from "../hooks/useReveal";

const tracks = [
  { name: "Coding Interview: DSA & Problem Solving", focus: "Find an approach to unfamiliar coding problems.", iconName: "route", svg: routeIcon },
  { name: "Backend System Design Interview", focus: "Design reliable systems and explain your choices.", iconName: "database", svg: databaseIcon },
  { name: "Object-Oriented Design Interview", focus: "Turn requirements into clear, flexible object designs.", iconName: "grid", svg: gridIcon },
  { name: "Frontend System Design Interview", focus: "Plan interfaces that stay fast as they grow.", iconName: "device-phone", svg: devicePhoneIcon },
  { name: "Google Cloud Associate Cloud Engineer", focus: "Practice running and managing Google Cloud services.", iconName: "server-stack", svg: serverStackIcon },
  { name: "AWS Certified Solutions Architect – Associate", focus: "Choose AWS services for real-world needs.", iconName: "cloud", svg: cloudIcon },
  { name: "Microsoft Azure Administrator Associate (AZ-104)", focus: "Practice setting up and troubleshooting Azure.", iconName: "settings", svg: settingsIcon },
  { name: "Microsoft Azure AI Fundamentals (AI-901)", focus: "Learn AI concepts and when to use Azure AI services.", iconName: "cpu", svg: cpuIcon },
];

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const menuToggleRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuToggleRef.current?.focus();
    };

    document.addEventListener("keydown", handleKeyDown);
    menuRef.current?.querySelector("a")?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <nav className="main-nav" aria-label="Main navigation">
          <div className="navigation-links">
            <a href="#product">Overview</a>
            <a href="#method">How it works</a>
            <a href="#tracks">Tracks</a>
          </div>
          <button
            aria-controls="compact-navigation"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            className={`nav-menu-toggle ${menuOpen ? "is-open" : ""}`.trim()}
            onClick={() => setMenuOpen((open) => !open)}
            ref={menuToggleRef}
            type="button"
          >
            <span className="nav-menu-toggle-label">Menu</span>
            <span className="nav-menu-toggle-icon" aria-hidden="true">{menuOpen ? "−" : "+"}</span>
          </button>
          <a className="button button-small button-primary nav-action" href="#session" onClick={closeMenu}>Try a question</a>
          <div ref={menuRef} className={`compact-navigation ${menuOpen ? "is-open" : ""}`.trim()} id="compact-navigation">
            <a href="#product" onClick={closeMenu}>Overview</a>
            <a href="#method" onClick={closeMenu}>How it works</a>
            <a href="#tracks" onClick={closeMenu}>Tracks</a>
          </div>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero section-shell" id="product" aria-labelledby="hero-title">
      <Reveal className="hero-copy">
        <p className="eyebrow">Get ready for your next challenge</p>
        <h1 id="hero-title">Build <span className="thesis-focus">confidence</span> through practice.</h1>
        <p className="hero-description">Practice for technical interviews and cloud certifications, one clear question at a time.</p>
        <div className="hero-actions">
          <a className="button button-primary" href="#session">Try a question <span aria-hidden="true">→</span></a>
          <a className="button button-secondary" href="#tracks">Explore tracks <span aria-hidden="true">→</span></a>
        </div>
        <p className="hero-note"><span className="status-dot" aria-hidden="true" /> Try a question. No account needed.</p>
      </Reveal>
      <Reveal className="hero-practice reveal-delay"><InteractiveQuestion /></Reveal>
    </section>
  );
}

function MethodSection() {
  return (
    <section className="content-section section-shell" id="method" aria-labelledby="method-title">
      <Reveal className="section-intro">
        <p className="eyebrow">How Patternly works</p>
        <h2 id="method-title">Learn from the answer.</h2>
        <p>Answer, see the reason, then try again with a clearer idea.</p>
      </Reveal>
      <div className="practice-steps">
        <Reveal as="article" className="practice-step">
          <div className="step-rail"><span>01</span></div><div className="step-content"><h3>Answer</h3><p>Choose the option that makes the most sense to you.</p></div>
        </Reveal>
        <Reveal as="article" className="practice-step reveal-delay-1">
          <div className="step-rail"><span>02</span></div><div className="step-content"><h3>See why</h3><p>Read feedback that connects the answer to the idea behind it.</p></div>
        </Reveal>
        <Reveal as="article" className="practice-step reveal-delay-2">
          <div className="step-rail"><span>03</span></div><div className="step-content"><h3>Try again</h3><p className="step-emphasis">Return to the question with a clearer understanding.</p></div>
        </Reveal>
      </div>
    </section>
  );
}

function TracksSection() {
  return (
    <section className="content-section tracks-section section-shell" id="tracks" aria-labelledby="tracks-title">
      <Reveal className="section-intro centered">
        <p className="eyebrow">Find your focus</p>
        <h2 id="tracks-title">What are you preparing for?</h2>
        <p>Explore eight learning tracks for coding interviews, system design, and cloud certifications.</p>
      </Reveal>
      <Reveal className="track-atlas reveal-delay">
        {tracks.map((track) => (
          <article className="track-card" key={track.name}>
            <span
              aria-hidden="true"
              className="track-icon"
              data-track-icon={track.iconName}
              dangerouslySetInnerHTML={{ __html: track.svg }}
            />
            <div><h3>{track.name}</h3><p>{track.focus}</p></div>
          </article>
        ))}
      </Reveal>
      <Reveal className="track-atlas-action"><a className="button button-secondary" href="#session">Try a question <span aria-hidden="true">→</span></a></Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner"><div className="footer-brand"><Brand /><p className="footer-tagline">Practice. Understand. Try again.</p><p className="footer-note">Make time for your next step.</p></div><div className="footer-explore"><p className="eyebrow">Explore</p><div><a href="#product">Overview</a><a href="#method">How it works</a><a href="#tracks">Tracks</a></div></div></div>
      <div className="footer-meta"><p>Patternly is an independent learning tool. It is not an official certification provider or a guarantee of exam outcomes.</p><p>Seller: Łukasz Kurczab. Purchases are not available on this site.</p><a href="/admin">Admin sign in</a></div>
    </footer>
  );
}

export function PublicPage() {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Header />
      <main id="main-content" tabIndex={-1}><Hero /><MethodSection /><TracksSection /></main>
      <Footer />
    </>
  );
}
