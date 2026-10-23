import { useGSAP } from "@gsap/react";
import { gsap } from "gsap/dist/gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function usePublicMotion(root) {
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("all", () => {
      const layers = gsap.utils.toArray(".pattern-layer");
      gsap.from(layers, { y: 100, rotationZ: -16, scale: .8, duration: 1.8, stagger: .06, ease: "power3.out" });
      gsap.from(".hero-line", { y: 50, duration: 1.2, stagger: .12, ease: "power3.out" });
      gsap.to(".pattern-float", { y: -20, rotationZ: 5, duration: 3.2, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(".pattern-stack", {
        rotationZ: 24, rotationY: -22, yPercent: 20, scale: .84, ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1 },
      });
      gsap.fromTo(".artwork-statement span", { opacity: .18 }, {
        opacity: 1, ease: "none", scrollTrigger: { trigger: ".motion-artwork", start: "top 75%", end: "center 50%", scrub: .6 },
      });
      gsap.fromTo(".scroll-progress", { scaleX: 0 }, {
        scaleX: 1, ease: "none", scrollTrigger: { trigger: root.current, start: "top top", end: "bottom bottom", scrub: .2 },
      });
      gsap.to(".site-header", {
        y: -6, scale: .985, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "+=320", scrub: .5 },
      });
      gsap.utils.toArray(".section-intro h2, .footer-cta h2").forEach((heading) => {
        gsap.from(heading, {
          y: 64, rotationX: 12, transformPerspective: 1000, transformOrigin: "50% 100%", ease: "none",
          scrollTrigger: { trigger: heading.parentElement, start: "top 95%", end: "top 40%", scrub: .65 },
        });
      });
      gsap.from(".method-promise", {
        y: 48, rotation: -3, ease: "none", scrollTrigger: { trigger: ".method-aside", start: "top 90%", end: "top 45%", scrub: .7 },
      });
      gsap.to(".inline-preview img", {
        yPercent: -18, scale: 1.5, ease: "none", scrollTrigger: { trigger: ".method-section", start: "top bottom", end: "center top", scrub: 1 },
      });
      gsap.utils.toArray(".practice-step").forEach((step) => {
        gsap.from(step.querySelector(".step-content"), {
          y: 42, ease: "none", scrollTrigger: { trigger: step, start: "top 95%", end: "top 65%", scrub: .6 },
        });
      });
      gsap.utils.toArray(".track-card").forEach((card, index) => {
        gsap.from(card, {
          y: 50 + (index % 3) * 22, ease: "none",
          scrollTrigger: { trigger: card, start: "top 98%", end: "top 68%", scrub: .65 },
        });
        gsap.from(card.querySelector(".track-icon"), {
          rotation: -30, scale: .75, ease: "none", scrollTrigger: { trigger: card, start: "top 95%", end: "top 55%", scrub: .8 },
        });
      });
      gsap.utils.toArray(".section-intro, .help-questions details").forEach((element) => {
        gsap.fromTo(element, { "--rule-scale": 0 }, {
          "--rule-scale": 1, ease: "none", scrollTrigger: { trigger: element, start: "top 92%", end: "top 48%", scrub: .6 },
        });
      });
      gsap.fromTo(".footer-watermark", { xPercent: -8 }, {
        xPercent: 8, ease: "none", scrollTrigger: { trigger: ".footer-cta", start: "top bottom", end: "bottom top", scrub: 1 },
      });
      gsap.from(".footer-cta .button", {
        y: 36, scale: .9, ease: "none", scrollTrigger: { trigger: ".footer-cta", start: "top 85%", end: "center 65%", scrub: .6 },
      });
    });
    media.add("(min-width: 1024px) and (min-height: 700px)", () => {
      const layers = gsap.utils.toArray(".pattern-layer");
      gsap.to(layers, { z: (index) => index * 22, rotationZ: (index) => index * 5, ease: "none", scrollTrigger: { trigger: ".motion-artwork", start: "top 65%", end: "bottom 20%", scrub: 1 } });
      const previews = gsap.utils.toArray(".app-previews figure");
      const gallery = root.current.querySelector(".app-previews");
      gsap.from(previews, { y: (index) => 60 + index * 45, rotation: (index) => (index - 1) * 4, stagger: .12, ease: "none", scrollTrigger: { trigger: gallery, start: "top bottom", end: "top 25%", scrub: 1 } });
      // Spread the screens through depth while all three links remain visible.
      gsap.timeline({ scrollTrigger: { trigger: gallery, pin: gallery, start: "top 128px", end: "+=420", scrub: .85, pinSpacing: true, invalidateOnRefresh: true } })
        .to(previews, { y: (index) => index === 1 ? -20 : 26, rotation: (index) => (index - 1) * 4, scale: (index) => index === 1 ? 1.035 : .94, duration: 1, ease: "none" })
        .to(previews, { y: 0, rotation: 0, scale: 1, duration: .65, ease: "none" });
    });
    media.add("(max-width: 1023px), (max-height: 699px)", () => {
      gsap.utils.toArray(".app-previews figure").forEach((figure) => {
        gsap.from(figure, { y: 52, scale: .92, ease: "none", scrollTrigger: { trigger: figure, start: "top 95%", end: "top 55%", scrub: .7 } });
      });
    });
    let active = true;
    document.fonts.ready.then(() => { if (active) ScrollTrigger.refresh(); });
    return () => { active = false; media.revert(); };
  }, { scope: root });
}
