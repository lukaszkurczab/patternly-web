import { useRef, useState } from "react";
import { useClientReady } from "../hooks/useClientReady";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap/dist/gsap";

export function MotionArtwork() {
  return (
    <div className="motion-artwork" aria-hidden="true">
      <div className="artwork-halo" />
      <div className="artwork-orbit orbit-one" /><div className="artwork-orbit orbit-two" />
      <div className="pattern-float"><div className="pattern-stack">
        {[0, 1, 2, 3, 4, 5].map((layer) => <div className="pattern-layer" key={layer} style={{ "--layer": layer }}><div className="pattern-window" /></div>)}
      </div></div>
      <div className="artwork-axis axis-left"><span>Make connections.</span><i /></div>
      <div className="artwork-axis axis-right"><i /><span>See the pattern.</span></div>
      <p className="artwork-statement">Find the pattern.<br /><span>Understand the why.</span></p>
    </div>
  );
}

const learningNotes = [
  { title: "Stay with the why.", text: "An explanation is a chance to understand the idea behind an answer, not just remember the right option." },
  { title: "Make a choice first.", text: "Choose the option that makes sense to you. Then use the feedback to examine your reasoning." },
  { title: "Come back clearer.", text: "Return to a question with what you learned. Notice what changes in the way you approach it." },
];

export function LearningNote() {
  const ready = useClientReady();
  const [index, setIndex] = useState(0);
  const note = learningNotes[index];
  return (
    <aside className="learning-note" aria-label="Practice tips" aria-roledescription="carousel">
      <div aria-live="polite" aria-atomic="true"><h3>{note.title}</h3><p>{note.text}</p></div>
      <div className="note-controls"><span>{index + 1} / {learningNotes.length}</span><div>
        <button disabled={!ready} type="button" aria-label="Previous practice tip" onClick={() => setIndex((index + learningNotes.length - 1) % learningNotes.length)}>←</button>
        <button disabled={!ready} type="button" aria-label="Next practice tip" onClick={() => setIndex((index + 1) % learningNotes.length)}>→</button>
      </div></div>
    </aside>
  );
}

const subjects = ["Coding interviews", "System design", "Cloud certifications", "AI architecture"];

export function TrackMarquee() {
  const root = useRef(null);
  useGSAP(() => {
    gsap.to(".marquee-rail", { xPercent: -50, duration: 32, ease: "none", repeat: -1 });
  }, { scope: root });
  return (
    <div className="subject-marquee" ref={root}>
      <p className="marquee-accessible">Practice coding interviews, system design, cloud certifications and AI architecture.</p>
      <div className="marquee-window" aria-hidden="true"><div className="marquee-rail">{[0, 1].map((copy) => <div className="marquee-copy" key={copy}>{subjects.map((subject) => <span key={subject}>{subject}<i>✳</i></span>)}</div>)}</div></div>
    </div>
  );
}
