import { useEffect, useRef, useState } from "react";
import { Brand } from "../components/Brand";
import { DecisionField } from "../components/DecisionField";
import { HeroQuestionCard, SessionQuestionCard } from "../components/InteractiveQuestion";
import { Reveal } from "../hooks/useReveal";

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
  const heroRef = useRef(null);

  const handlePointerMove = (event) => {
    const hero = event.currentTarget;
    const bounds = hero.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    hero.style.setProperty("--field-x", `${x * -18}px`);
    hero.style.setProperty("--field-y", `${y * -10}px`);
  };

  const handlePointerLeave = () => {
    heroRef.current?.style.setProperty("--field-x", "0px");
    heroRef.current?.style.setProperty("--field-y", "0px");
  };

  return (
    <section ref={heroRef} className="hero section-shell" id="product" aria-labelledby="hero-title" onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave}>
      <DecisionField />
      <Reveal className="hero-copy">
        <p className="eyebrow">Technical practice, reimagined</p>
        <h1 id="hero-title">Practice the decision behind the answer.</h1>
        <p className="hero-description">Patternly turns technical mistakes into a concrete next practice action.</p>
        <div className="hero-actions">
          <a className="button button-primary" href="#method">Explore the practice loop <span aria-hidden="true">→</span></a>
          <a className="button button-secondary" href="#session">Try the local practice demo <span aria-hidden="true">→</span></a>
        </div>
        <p className="hero-note"><span className="status-dot" aria-hidden="true" /> Local, offline-first practice for technical decisions.</p>
      </Reveal>
      <Reveal className="hero-stage reveal-delay">
        <div className="trace-graphic" aria-hidden="true">
          <span className="trace-line trace-line-one" /><span className="trace-line trace-line-two" /><span className="trace-line trace-line-three" /><span className="trace-line trace-line-four" />
          <span className="trace-node trace-node-one" /><span className="trace-node trace-node-two" /><span className="trace-node trace-node-three" /><span className="trace-node trace-node-four" /><span className="trace-node trace-node-five" />
        </div>
        <p className="trace-label">Decision trace / 01</p>
        <HeroQuestionCard />
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
        <p>Patternly keeps the question, your response, the explanation, and the next practice action in one focused flow — so every session builds on the decision you just made.</p>
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
        <p className="eyebrow">Two families, one focus</p>
        <h2 id="tracks-title">Two families. One focus: deliberate technical practice.</h2>
      </Reveal>
      <Reveal className="family-grid reveal-delay">
        <article className="family-card"><div className="family-index">01</div><h3>Algorithms</h3><p>Mental units, pattern recognition, strategy selection, contrasts, ordering, and complexity reasoning.</p><ul><li>Learn approach</li><li>Guided practice</li><li>Recognize patterns</li><li>Contrast practice</li><li>Weak area review</li><li>Independent practice</li><li>Interview simulation</li></ul><a className="button button-primary" href="#method">See the practice method <span aria-hidden="true">→</span></a></article>
        <article className="family-card"><div className="family-index">02</div><h3>Certification</h3><p>Scenario decisions, competency evidence, remediation, and profile-backed simulation where supported.</p><ul><li>Diagnostic baseline</li><li>Focus practice</li><li>Scenario practice</li><li>Weak area review</li><li>Mixed practice</li><li>Quick review</li><li>Exam simulation</li></ul><a className="button button-primary" href="#session">Try the local demo <span aria-hidden="true">→</span></a></article>
      </Reveal>
      <Reveal className="section-footnote">Simulation behaviour depends on the applicable profile or family contract. Not every certification track includes an official simulation profile.</Reveal>
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
  useEffect(() => {
    const progress = document.querySelector("[data-page-progress]");
    if (!progress) return undefined;
    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
        progress.style.transform = `scaleY(${Math.min(1, Math.max(0, ratio))})`;
        frame = 0;
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="page-progress" aria-hidden="true"><span data-page-progress /></div>
      <Header />
      <main id="main-content" tabIndex={-1}><Hero /><MethodSection /><SessionSection /><EvidenceSection /><TracksSection /><BoundariesSection /></main>
      <Footer />
    </>
  );
}
