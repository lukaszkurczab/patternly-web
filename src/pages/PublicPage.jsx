import { useEffect, useRef, useState } from "react";
import { Brand } from "../components/Brand";
import { DecisionField } from "../components/DecisionField";
import { HeroQuestionCard, SessionQuestionCard } from "../components/InteractiveQuestion";
import { Reveal } from "../hooks/useReveal";

const tracks = [
  { name: "Coding Interview: DSA & Problem Solving", focus: "Patterns · strategy · complexity", glyph: "branch" },
  { name: "Backend System Design Interview", focus: "Boundaries · trade-offs · architecture", glyph: "system" },
  { name: "Object-Oriented Design Interview", focus: "Models · responsibilities · invariants", glyph: "objects" },
  { name: "Frontend System Design Interview", focus: "State · performance · delivery", glyph: "interface" },
  { name: "Google Cloud Associate Cloud Engineer", focus: "Scenario decisions · operations", glyph: "cloud-a" },
  { name: "AWS Certified Solutions Architect – Associate", focus: "Architecture choices · trade-offs", glyph: "cloud-b" },
  { name: "Microsoft Azure Administrator Associate (AZ-104)", focus: "Configuration · diagnosis · operations", glyph: "cloud-c" },
  { name: "Microsoft Azure AI Fundamentals (AI-901)", focus: "Concept recognition · scenario fit", glyph: "ai" },
];

function TrackGlyph({ variant }) {
  return (
    <span className={`track-glyph track-glyph-${variant}`} aria-hidden="true">
      <span /><span /><span /><span />
    </span>
  );
}

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
            <a href="#product">Product</a>
            <a href="#method">Method</a>
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
          <a className="button button-small button-primary nav-action" href="#session" onClick={closeMenu}>Try the local demo</a>
          <div ref={menuRef} className={`compact-navigation ${menuOpen ? "is-open" : ""}`.trim()} id="compact-navigation">
            <a href="#product" onClick={closeMenu}>Product</a>
            <a href="#method" onClick={closeMenu}>Method</a>
            <a href="#tracks" onClick={closeMenu}>Tracks</a>
          </div>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  const [selected, setSelected] = useState("");
  const decisionState = selected ? (selected === "b" ? "resolved" : "focused") : "neutral";

  return (
    <section className="hero section-shell" id="product" aria-labelledby="hero-title">
      <Reveal className="hero-copy">
        <p className="eyebrow">Technical practice, reimagined</p>
        <h1 id="hero-title">Practice the <span className="thesis-focus">decision</span> behind the answer.</h1>
        <p className="hero-description">Patternly turns technical mistakes into a concrete next practice action.</p>
        <div className="hero-actions">
          <a className="button button-primary" href="#method">Explore the practice loop <span aria-hidden="true">→</span></a>
          <a className="button button-secondary" href="#session">Try the local practice demo <span aria-hidden="true">→</span></a>
        </div>
        <p className="hero-note"><span className="status-dot" aria-hidden="true" /> Local, offline-first practice for technical decisions.</p>
      </Reveal>
      <Reveal className="hero-stage reveal-delay">
        <DecisionField state={decisionState} />
        <HeroQuestionCard selected={selected} onSelect={setSelected} />
      </Reveal>
    </section>
  );
}

function MethodSection() {
  return (
    <section className="content-section section-shell" id="method" aria-labelledby="method-title">
      <Reveal className="section-intro">
        <p className="eyebrow">How Patternly works</p>
        <h2 id="method-title">A mistake is useful when it changes what you practice next.</h2>
        <p>Patternly keeps the explanation close to the decision, the mechanism, and the next bounded practice step.</p>
      </Reveal>
      <div className="practice-steps">
        <Reveal as="article" className="practice-step">
          <div className="step-rail"><span>01</span></div><div className="step-content"><h3>Identify the decision</h3><p>Clarify the specific choice that led to the mistake.</p></div>
        </Reveal>
        <Reveal as="article" className="practice-step reveal-delay-1">
          <div className="step-rail"><span>02</span></div><div className="step-content"><h3>Understand the mechanism</h3><p>Connect the decision to the underlying database behavior.</p><div className="technical-note"><span>e.g.</span><span>Composite index column order determines whether the planner can avoid a full scan.</span></div></div>
        </Reveal>
        <Reveal as="article" className="practice-step reveal-delay-2">
          <div className="step-rail"><span>03</span></div><div className="step-content"><h3>Correct the relevant mistake</h3><p>Fix the immediate error with a precise technical adjustment.</p></div>
        </Reveal>
        <Reveal as="article" className="practice-step reveal-delay-3">
          <div className="step-rail"><span>04</span></div><div className="step-content"><h3>Take the next useful practice action</h3><p className="step-emphasis">Retry the same composite-index decision with the reason visible.</p></div>
        </Reveal>
      </div>
    </section>
  );
}

function SessionSection() {
  return (
    <section className="content-section session-section section-shell" id="session" aria-labelledby="session-title">
      <Reveal className="section-intro">
        <p className="eyebrow">Inside a session</p>
        <h2 id="session-title">Practice the mechanism, not just the answer.</h2>
        <p>This local demo keeps your response and its reason in one focused flow. It does not save attempts or calculate a review schedule; reset to retry the same question.</p>
      </Reveal>
      <Reveal className="session-layout reveal-delay">
        <SessionQuestionCard />
        <aside className="session-annotations" aria-label="Session principles">
          <div><span className="annotation-index">01</span><p>No timer — local demo</p></div>
          <div><span className="annotation-index">02</span><p>Concise reason first; full explanation on demand</p></div>
          <div><span className="annotation-index">03</span><p>Every response points to a useful next action</p></div>
        </aside>
      </Reveal>
    </section>
  );
}

function EvidenceSection() {
  return (
    <section className="content-section section-shell" aria-labelledby="evidence-title">
      <Reveal className="section-intro">
        <p className="eyebrow">How evidence drives next steps</p>
        <h2 id="evidence-title">The next practice action should be explainable.</h2>
        <p>This local page shows one fixed SQL-indexing question and its explanation. It does not record attempts or calculate a review schedule.</p>
      </Reveal>
      <Reveal className="evidence-layout reveal-delay">
        <article className="recommendation-panel">
          <div className="evidence-visual" aria-hidden="true" />
          <div className="panel-kicker"><span className="status-dot" aria-hidden="true" /> Local demo</div>
          <h3>Practice: composite index ordering.</h3>
          <p>Use the local SQL question to inspect how the leading customer_id constraint lets the composite index narrow the date range. Resetting it lets you retry the same question.</p>
          <div className="panel-actions"><a className="button button-primary" href="#session">Open the SQL question</a><a className="text-link" href="#method">See the practice loop <span aria-hidden="true">→</span></a></div>
        </article>
        <div className="evidence-list">
          <p className="eyebrow">Demo scope</p>
          <div className="evidence-row"><strong>Question</strong><span>One fixed SQL composite-index scenario.</span></div>
          <div className="evidence-row"><strong>Feedback</strong><span>The reason updates from your current local selection.</span></div>
          <div className="evidence-row"><strong>Available action</strong><span>Reset and retry this same question.</span></div>
        </div>
      </Reveal>
    </section>
  );
}

function TracksSection() {
  return (
    <section className="content-section tracks-section section-shell" id="tracks" aria-labelledby="tracks-title">
      <Reveal className="section-intro centered">
        <p className="eyebrow">Launch catalogue</p>
        <h2 id="tracks-title">Eight tracks. One practice model.</h2>
        <p>Each track changes the decisions and evidence that matter. The learning loop stays precise and consistent.</p>
      </Reveal>
      <Reveal className="track-atlas reveal-delay">
        {tracks.map((track) => (
          <article className="track-card" key={track.name}>
            <TrackGlyph variant={track.glyph} />
            <div><h3>{track.name}</h3><p>{track.focus}</p></div>
          </article>
        ))}
      </Reveal>
      <Reveal className="track-atlas-action"><a className="button button-secondary" href="#method">See the shared practice loop <span aria-hidden="true">→</span></a></Reveal>
    </section>
  );
}

function BoundariesSection() {
  return (
    <section className="boundaries-section section-shell" aria-labelledby="boundaries-title">
      <Reveal className="boundary-card">
        <div className="boundary-copy"><p className="eyebrow">A clearer way to practice</p><h2 id="boundaries-title">Built for practice you can inspect.</h2><p>Patternly is a local, offline-first focus lab for technical decision practice. It shows the current response, explains what matters, and makes the next action explicit.</p></div>
        <div className="boundary-principles"><p><strong>Evidence before certainty</strong><span>Show what the current response supports and state when evidence is limited.</span></p><p><strong>Mechanism before motivation</strong><span>Connect feedback to the decision, constraint, invariant, or trade-off that matters.</span></p><p><strong>Practice before performance theatre</strong><span>No gamified status, synthetic readiness, or claims of official outcomes.</span></p></div>
        <p className="boundary-note">Patternly does not replace an official exam, an online judge, or a source of guaranteed outcomes.</p>
        <a className="button button-primary boundary-action" href="#method">Explore the practice loop <span aria-hidden="true">→</span></a>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner"><div className="footer-brand"><Brand /><p className="footer-tagline">Practice the decision. Inspect the why.</p><p className="footer-note">Built for deliberate technical practice.</p></div><div className="footer-explore"><p className="eyebrow">Explore</p><div><a href="#product">Product</a><a href="#method">Method</a><a href="#tracks">Tracks</a></div></div></div>
      <div className="footer-meta"><p>Patternly is an independent learning tool. It is not an official certification provider or a guarantee of exam outcomes.</p><p>Seller: Łukasz Kurczab. Purchases are unavailable until consumer information and secure payment are published.</p><a href="/admin">Administrator entry</a></div>
    </footer>
  );
}

export function PublicPage() {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Header />
      <main id="main-content" tabIndex={-1}><Hero /><MethodSection /><SessionSection /><EvidenceSection /><TracksSection /><BoundariesSection /></main>
      <Footer />
    </>
  );
}
