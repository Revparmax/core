import { useEffect, useRef, useState } from "react";

interface Options {
  once?: boolean;
  rootMargin?: string;
  threshold?: number;
}

/**
 * Adds a `lit` flag (and a matching `data-lit` attribute on the returned ref)
 * the first time an element scrolls into view. Components use this to trigger
 * the chart "ignite" beat — draw-on lines, count-up numbers, ember glow on
 * the live edge. Honors `prefers-reduced-motion` by firing immediately.
 */
export function useReveal<T extends HTMLElement>(options: Options = {}) {
  const {
    threshold = 0.25,
    rootMargin = "0px 0px -12% 0px",
    once = true,
  } = options;
  const ref = useRef<T | null>(null);
  const [lit, setLit] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion || !("IntersectionObserver" in window)) {
      setLit(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setLit(true);
            if (once) {
              observer.unobserve(entry.target);
            }
          } else if (!once) {
            setLit(false);
          }
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return { ref, lit };
}
