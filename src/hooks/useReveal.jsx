import { useLayoutEffect, useRef } from "react";

export function useReveal() {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const reveal = () => {
      element.classList.add("is-visible");
    };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || !("IntersectionObserver" in window)) {
      reveal();
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        reveal();
        observer.disconnect();
      },
      { rootMargin: "0px 0px -8%" },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  return ref;
}

export function Reveal({ as: Component = "div", className = "", children }) {
  const ref = useReveal();
  return (
    <Component ref={ref} className={`reveal ${className}`.trim()}>
      {children}
    </Component>
  );
}
