import { useLayoutEffect, useRef } from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

function supportsInert() {
  return "inert" in HTMLElement.prototype;
}

function getFocusableDescendants(element) {
  const descendants = Array.from(element.querySelectorAll(focusableSelector));
  return descendants;
}

function suppressFocusableDescendants(element, state) {
  const suppress = (candidate) => {
    const controls = candidate.matches?.(focusableSelector) ? [candidate] : getFocusableDescendants(candidate);
    controls.forEach((control) => {
      const tabIndex = control.getAttribute("tabindex");
      if (tabIndex === "-1") return;
      state.tabIndexes.set(control, tabIndex);
      control.setAttribute("tabindex", "-1");
    });
  };

  state.ariaHidden = element.getAttribute("aria-hidden");
  element.setAttribute("aria-hidden", "true");
  suppress(element);
  state.observer = new MutationObserver((records) => {
    records.forEach((record) => {
      if (record.type === "childList") {
        record.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) suppress(node);
        });
      } else {
        suppress(record.target);
      }
    });
  });
  state.observer.observe(element, {
    attributes: true,
    attributeFilter: ["disabled", "tabindex", "href", "contenteditable"],
    childList: true,
    subtree: true,
  });
}

function restoreFocusableDescendants(element, state) {
  state.observer?.disconnect();
  state.tabIndexes.forEach((tabIndex, control) => {
    if (!control.isConnected || control.getAttribute("tabindex") !== "-1") return;
    if (tabIndex === null) control.removeAttribute("tabindex");
    else control.setAttribute("tabindex", tabIndex);
  });
  state.tabIndexes.clear();
  if (element.getAttribute("aria-hidden") === "true") {
    if (state.ariaHidden === null) element.removeAttribute("aria-hidden");
    else element.setAttribute("aria-hidden", state.ariaHidden);
  }
}

export function useReveal() {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const useNativeInert = supportsInert();
    const fallbackState = { ariaHidden: null, observer: null, tabIndexes: new Map() };
    const reveal = () => {
      if (useNativeInert) element.inert = false;
      else restoreFocusableDescendants(element, fallbackState);
      element.classList.add("is-visible");
    };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || !("IntersectionObserver" in window)) {
      reveal();
      return undefined;
    }

    if (useNativeInert) element.inert = true;
    else suppressFocusableDescendants(element, fallbackState);

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
      if (useNativeInert) element.inert = false;
      else restoreFocusableDescendants(element, fallbackState);
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
