import { useClientReady } from "../hooks/useClientReady";
import routeIcon from "../../assets/icons/route.svg?raw";
import databaseIcon from "../../assets/icons/database.svg?raw";
import gridIcon from "../../assets/icons/grid.svg?raw";
import devicePhoneIcon from "../../assets/icons/device-phone.svg?raw";
import serverStackIcon from "../../assets/icons/server-stack.svg?raw";
import cloudIcon from "../../assets/icons/cloud.svg?raw";
import settingsIcon from "../../assets/icons/settings.svg?raw";
import cpuIcon from "../../assets/icons/cpu.svg?raw";
import sparkleIcon from "../../assets/icons/sparkle.svg?raw";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppAvailability } from "../components/AppAvailability";
import { Brand } from "../components/Brand";
import { InteractiveQuestion } from "../components/InteractiveQuestion";
import { Reveal } from "../hooks/useReveal";
import demoCatalog from "../generated/demoQuestions.json";
import { publicTrackPages } from "../publicTrackPages.js";

const publicLegal = __PATTERNLY_PUBLIC_LEGAL__;

const tracks = [
  { id: "coding-interview-dsa-problem-solving", name: "Coding Interview: DSA & Problem Solving", focus: "Find an approach to unfamiliar coding problems.", demoLabel: "Coding Interview", demoAction: "Try a coding question", demoNote: "This Coding Interview example uses one Free practice question. It does not save your progress or schedule reviews.", iconName: "route", svg: routeIcon },
  { id: "backend-system-design-interview", name: "Backend System Design Interview", focus: "Design reliable systems and explain your choices.", iconName: "database", svg: databaseIcon },
  { id: "object-oriented-design-interview", name: "Object-Oriented Design Interview", focus: "Turn requirements into clear, flexible object designs.", iconName: "grid", svg: gridIcon },
  { id: "frontend-system-design-interview", name: "Frontend System Design Interview", focus: "Plan interfaces that stay fast as they grow.", iconName: "device-phone", svg: devicePhoneIcon },
  { id: "google-cloud-associate-cloud-engineer", name: "Google Cloud Associate Cloud Engineer", focus: "Practice running and managing Google Cloud services.", legalNote: "Independent study content. Not affiliated with or endorsed by Google.", iconName: "server-stack", svg: serverStackIcon },
  { id: "aws-certified-solutions-architect-associate", name: "AWS Certified Solutions Architect - Associate", focus: "Choose AWS services for real-world needs.", legalNote: "Independent study content. Not affiliated with or endorsed by Amazon Web Services.", demoLabel: "AWS certification", demoAction: "Try an AWS question", demoNote: "This AWS certification example uses one Free practice question. It does not save your progress or schedule reviews.", iconName: "cloud", svg: cloudIcon },
  { id: "microsoft-azure-administrator-associate-az-104", name: "Microsoft Azure Administrator Associate AZ-104", focus: "Practice setting up and troubleshooting Azure.", legalNote: "Independent study content. Not affiliated with or endorsed by Microsoft.", iconName: "settings", svg: settingsIcon },
  { id: "microsoft-azure-ai-fundamentals-ai-901", name: "Microsoft Azure AI Fundamentals AI-901", focus: "Learn AI concepts and when to use Azure AI services.", legalNote: "Independent study content. Not affiliated with or endorsed by Microsoft.", iconName: "cpu", svg: cpuIcon },
  { id: "claude-certified-architect-professional-certification", name: "Claude Certified Architect – Professional", focus: "Independent practice for designing and operating production Claude systems, from solution architecture and evaluation to governance and delivery.", legalNote: "Independent study content. Not affiliated with or endorsed by Anthropic.", iconName: "sparkle", svg: sparkleIcon },
];
const demosByTrackId = new Map(demoCatalog.demos.map((demo) => [demo.provenance.trackId, demo]));

function Header() {
  const ready = useClientReady();
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
            <a href="#tracks">Tracks</a><a href="#help">Help</a>
          </div>
          <button
            disabled={!ready}
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
            <a href="#tracks" onClick={closeMenu}>Tracks</a><a href="#help" onClick={closeMenu}>Help</a>
          </div>
        </nav>
      </div>
      <noscript><nav className="no-script-nav" aria-label="Page sections"><a href="#product">Overview</a><a href="#method">How it works</a><a href="#tracks">Tracks</a><a href="#help">Help</a></nav></noscript>
    </header>
  );
}

function Hero({ selectedTrack, question, titleRef }) {
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
        <AppAvailability className="hero-note" />
      </Reveal>
      <Reveal className="hero-practice reveal-delay"><InteractiveQuestion key={`${selectedTrack.id}:${question.provenance.questionId}`} demo={question} progressNote={selectedTrack.demoNote} titleRef={titleRef} trackLabel={selectedTrack.demoLabel} /></Reveal>
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

function TracksSection({ selectedTrackId, onSelectTrack, ready }) {
  return (
    <section className="content-section tracks-section section-shell" id="tracks" aria-labelledby="tracks-title">
      <Reveal className="section-intro centered">
        <p className="eyebrow">Find your focus</p>
        <h2 id="tracks-title">What are you preparing for?</h2>
        <p>Explore nine learning tracks for coding interviews, system design, cloud and AI certifications.</p>
      </Reveal>
      <Reveal className="track-atlas reveal-delay">
        {tracks.map((track) => (
          <article className="track-card" id={track.id} data-track-id={track.id} key={track.id}>
            <span
              aria-hidden="true"
              className="track-icon"
              data-track-icon={track.iconName}
              dangerouslySetInnerHTML={{ __html: track.svg }}
            />
            <div><h3>{track.name}</h3><p>{track.focus}</p>{track.legalNote ? <p className="track-legal-note">{track.legalNote}</p> : null}{publicTrackPages.find((page) => page.trackId === track.id) ? <p><a className="track-guide-link" href={publicTrackPages.find((page) => page.trackId === track.id).path}>Read the practice guide</a></p> : null}</div>
            {demosByTrackId.has(track.id) ? <button disabled={!ready} aria-pressed={selectedTrackId === track.id} className="track-demo-button" onClick={() => onSelectTrack(track.id)} type="button">{track.demoAction}</button> : null}
          </article>
        ))}
      </Reveal>
      <Reveal className="track-atlas-action"><a className="button button-secondary" href="#session">Try a question <span aria-hidden="true">→</span></a></Reveal>
    </section>
  );
}

function AppSection() {
  return (
    <section className="content-section section-shell" id="app" aria-labelledby="app-title">
      <Reveal className="section-intro">
        <p className="eyebrow">Inside the app</p>
        <h2 id="app-title">A place to return to your practice.</h2>
        <p>For people preparing for technical interviews or studying cloud and AI concepts. Choose a topic, work through questions and explanations, and revisit your learning history.</p>
      </Reveal>
      <div className="practice-steps">
        <article className="practice-step"><div className="step-content"><h3>Choose a focus</h3><p>Browse tracks and topics in Practice. Access depends on the topic and mode you select.</p></div></article>
        <article className="practice-step"><div className="step-content"><h3>Understand the reasoning</h3><p>Work through practice questions and read feedback. Use explanations to examine the choices, not just memorise an answer.</p></div></article>
        <article className="practice-step"><div className="step-content"><h3>Return to your work</h3><p>The app keeps learning history and a Progress view. This website demo does not save progress or schedule reviews.</p></div></article>
      </div>
      <p className="app-preview-note">Actual screens from the iOS development version, using a fictional profile and demonstration practice history. Premium access is enabled locally; no purchase is shown.</p>
      <div className="app-previews">
        <figure>
          <a href="/app-preview/topics-ios.png" aria-label="View the topic and practice modes screen at full size">
            <img src="/app-preview/topics-ios.png" alt="Coding Interview practice screen with an active topic, practice modes and a Premium label on Coding Mock Interview." width="1206" height="2622" loading="lazy" decoding="async" />
          </a>
          <figcaption>Choose a topic and see its practice modes.</figcaption>
        </figure>
        <figure>
          <a href="/app-preview/practice-ios.png" aria-label="View the practice screen at full size">
            <img src="/app-preview/practice-ios.png" alt="Practice question with the correct answer highlighted and its explanation below." width="1206" height="2622" loading="lazy" decoding="async" />
          </a>
          <figcaption>Read the reasoning after each answer.</figcaption>
        </figure>
        <figure>
          <a href="/app-preview/today-ios.png" aria-label="View the Today screen at full size">
            <img src="/app-preview/today-ios.png" alt="Today screen for Coding Interview showing ten answers recorded this week on a fictional profile." width="1206" height="2622" loading="lazy" decoding="async" />
          </a>
          <figcaption>Return to your activity for the week.</figcaption>
        </figure>
      </div>
    </section>
  );
}

function HelpSection() {
  return (
    <section className="content-section section-shell" id="help" aria-labelledby="help-title">
      <Reveal className="section-intro">
        <p className="eyebrow">Before you begin</p>
        <h2 id="help-title">Questions about Patternly</h2>
      </Reveal>
      <div className="help-questions">
        <details><summary>Can I download the app?</summary><AppAvailability /></details>
        <details><summary>What can I try here?</summary><p>Choose the Coding Interview or AWS example, answer one question and read its feedback and key idea. You can reset the example or switch tracks. This is a small sample, not a full course or an assessment of exam readiness.</p></details>
        <details><summary>What is Free, and what requires Premium?</summary><p>In the current app, each track includes one complete Free topic, including Design Interview. Remaining topics, certification exam simulations and Coding and Design Interview simulations require Premium access.</p><p>Premium is intended to cover Premium content across tracks through one subscription. Purchases are not available yet. The website demo is free and does not sell subscriptions.</p></details>
        <details><summary>Do I need an account?</summary><p>No account is needed for this demo. In the app, you can begin Free learning as a guest. Premium purchases require an account when they become available.</p></details>
        <details><summary>Who is responsible, and how can I report a problem?</summary><p>Patternly is operated by {publicLegal.publicProfile.operator.legalName.en}. Its learning material is independent of certification providers. It does not guarantee exam results or replace official exam guidance.</p><p>For a question or content issue, include the track and question title, and describe what seems wrong. Do not send passwords or recovery codes.</p><p><a href={`mailto:${encodeURIComponent(publicLegal.publicProfile.operator.email.en)}`}>Email the Patternly operator</a> · <a href={publicLegal.publicLinks.supportUrl}>Support information</a></p></details>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner"><div className="footer-brand"><Brand /><p className="footer-tagline">Practice. Understand. Try again.</p><p className="footer-note">Make time for your next step.</p></div><div className="footer-explore"><p className="eyebrow">Explore</p><div><a href="#product">Overview</a><a href="#method">How it works</a><a href="#tracks">Tracks</a><a href="#help">Help</a></div></div></div>
      <div className="footer-meta"><p>Patternly is an independent learning tool. It is not an official certification provider or a guarantee of exam outcomes.</p><p>Seller: {publicLegal.publicProfile.operator.legalName.en}. Purchases are not available on this site.</p><nav aria-label="Legal and support"><a href={publicLegal.publicLinks.privacyUrl}>Privacy</a><a href={publicLegal.publicLinks.termsUrl}>Terms</a><a href={publicLegal.publicLinks.supportUrl}>Support</a></nav></div>
    </footer>
  );
}

export function PublicPage() {
  const ready = useClientReady();
  const [selectedTrackId, setSelectedTrackId] = useState("coding-interview-dsa-problem-solving");
  const questionTitleRef = useRef(null);
  const previousTrackId = useRef(selectedTrackId);
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId);
  const selectedQuestion = demosByTrackId.get(selectedTrackId);

  const selectTrack = (trackId) => {
    if (trackId !== selectedTrackId) {
      setSelectedTrackId(trackId);
      return;
    }
    document.getElementById("session")?.scrollIntoView({ block: "start" });
    questionTitleRef.current?.focus({ preventScroll: true });
  };

  useLayoutEffect(() => {
    if (previousTrackId.current === selectedTrackId) return;
    previousTrackId.current = selectedTrackId;
    document.getElementById("session")?.scrollIntoView({ block: "start" });
    questionTitleRef.current?.focus({ preventScroll: true });
  }, [selectedTrackId]);

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Header />
      <main id="main-content" tabIndex={-1}><Hero selectedTrack={selectedTrack} question={selectedQuestion} titleRef={questionTitleRef} /><MethodSection /><AppSection /><TracksSection ready={ready} selectedTrackId={selectedTrackId} onSelectTrack={selectTrack} /><HelpSection /></main>
      <Footer />
    </>
  );
}
