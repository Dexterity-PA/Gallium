"use client";

// The marketing site's fixed top nav.
//
// Condense mechanism: the bar is position: fixed, so the document below it
// never reflows. Past 0.8 * innerHeight of scroll, the vertical padding
// SNAPS to the compact value (no height animation, per the wave brief) while
// a solid background layer with a hairline bottom rule crossfades in over
// 200ms, opacity only. Scrolling back up reverses it; this two way toggle is
// the sanctioned custom motion, not a Reveal replay.
//
// Reduced motion: every transition collapses to an instant state change.
// This is done in CSS (the .site-nav-anim media query below), never by
// branching the inline style on a JS media-query hook: the hook resolves
// only after hydration, so a JS branch makes the server HTML disagree with
// the client's first render and React 19 throws a hydration error.
//
// Mobile (below md / 768px): the center links and CTA collapse behind a
// hamburger button that opens a full screen sheet. The sheet stays mounted
// and toggles via opacity + visibility so it can fade; visibility: hidden
// also removes its links from the tab order when closed. Escape closes and
// returns focus to the trigger. Scroll containment happens on the sheet
// itself (overflow-y auto + overscroll-behavior contain); globals are never
// touched.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { NAV } from "@/lib/site/content";

const CONDENSE_MS = 200;
const CONDENSE_AT = 0.8; // fraction of innerHeight the hero must clear

export default function SiteNav() {
  const [condensed, setCondensed] = useState(false);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // ---- condense on scroll (rAF throttled, passive) -----------------------
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      setCondensed(window.scrollY > window.innerHeight * CONDENSE_AT);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const closeSheet = useCallback((refocusTrigger: boolean) => {
    setOpen(false);
    if (refocusTrigger) triggerRef.current?.focus();
  }, []);

  // ---- Escape closes the sheet and restores focus ------------------------
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSheet(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeSheet]);

  // ---- crossing the md breakpoint while open closes the sheet ------------
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [open]);

  const fade = `opacity ${CONDENSE_MS}ms ease`;
  const sheetTransition = `opacity ${CONDENSE_MS}ms ease, transform ${CONDENSE_MS}ms ease, visibility 0s linear ${
    open ? "0s" : `${CONDENSE_MS}ms`
  }`;
  const iconTransition = `transform ${CONDENSE_MS}ms ease`;

  const labelType: CSSProperties = {
    fontFamily: "var(--site-font-mono)",
    fontSize: "var(--site-t-label)",
    letterSpacing: "var(--site-ls-label)",
    lineHeight: "var(--site-lh-heading)",
  };

  return (
    <header className="fixed inset-x-0 top-0 z-[90]">
      <div
        className="relative"
        style={{
          paddingInline: "var(--site-gutter)",
          // Snapped, never animated: a fixed bar's internal height change
          // cannot reflow the document, and snapping avoids height motion.
          paddingBlock: condensed ? "0.75rem" : "var(--site-sp-3)",
        }}
      >
        {/* background layer: crossfades in when condensed (or sheet open) */}
        <div
          aria-hidden
          className="site-nav-anim absolute inset-0"
          style={{
            background: "var(--site-bg)",
            borderBottom: "1px solid var(--site-rule)",
            opacity: condensed || open ? 1 : 0,
            transition: fade,
          }}
        />

        {/* bar row: always above the sheet so wordmark + close stay visible */}
        <div className="relative z-10 flex items-center justify-between">
          <a
            href="#"
            style={{ ...labelType, color: "var(--site-fg)", fontWeight: 500 }}
          >
            {NAV.wordmark}
          </a>

          {/* center links, desktop only */}
          <nav className="absolute left-1/2 hidden -translate-x-1/2 md:block">
            <ul className="flex items-center gap-[var(--site-sp-4)]">
              {NAV.links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="site-nav-link"
                    style={{ ...labelType, color: "var(--site-fg-dim)" }}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* right: desktop CTA, a plain <a> because /app must mount fresh */}
          <a
            href={NAV.cta.href}
            className="site-nav-cta hidden md:inline-block"
            style={{
              ...labelType,
              color: "var(--site-accent)",
              border: "1px solid var(--site-accent)",
              borderRadius: "2px",
              padding: "0.5rem 1rem",
            }}
          >
            {NAV.cta.label}
          </a>

          {/* right: mobile trigger */}
          <button
            ref={triggerRef}
            type="button"
            aria-expanded={open}
            aria-controls="site-nav-sheet"
            aria-label={NAV.menuLabel}
            onClick={() => (open ? closeSheet(true) : setOpen(true))}
            className="relative -mr-2 flex h-10 w-10 items-center justify-center md:hidden"
            style={{ color: "var(--site-fg)" }}
          >
            <span
              aria-hidden
              className="site-nav-anim absolute block h-px w-5 bg-current"
              style={{
                transform: open ? "rotate(45deg)" : "translateY(-3px)",
                transition: iconTransition,
              }}
            />
            <span
              aria-hidden
              className="site-nav-anim absolute block h-px w-5 bg-current"
              style={{
                transform: open ? "rotate(-45deg)" : "translateY(3px)",
                transition: iconTransition,
              }}
            />
          </button>
        </div>

        {/* mobile sheet: AFTER the bar row in DOM so Tab from the trigger
            moves into the sheet links; the row's z-10 keeps the bar painted
            on top. Mounted always, toggled via opacity + visibility so it
            can fade and its links leave the tab order when closed. */}
        <div
          id="site-nav-sheet"
          className="site-nav-anim fixed inset-0 md:hidden"
          style={{
            background: "var(--site-bg)",
            opacity: open ? 1 : 0,
            visibility: open ? "visible" : "hidden",
            transform: open ? "translateY(0)" : "translateY(-8px)",
            transition: sheetTransition,
            overflowY: "auto",
            overscrollBehavior: "contain",
            paddingInline: "var(--site-gutter)",
            paddingTop: "var(--site-sp-6)",
            paddingBottom: "var(--site-sp-5)",
          }}
        >
          <nav>
            <ul style={{ borderTop: "1px solid var(--site-rule)" }}>
              {NAV.links.map((link) => (
                <li key={link.href} style={{ borderBottom: "1px solid var(--site-rule)" }}>
                  <a
                    href={link.href}
                    onClick={() => closeSheet(false)}
                    className="block"
                    style={{
                      ...labelType,
                      color: "var(--site-fg)",
                      paddingBlock: "var(--site-sp-3)",
                    }}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <a
            href={NAV.cta.href}
            onClick={() => closeSheet(false)}
            className="mt-[var(--site-sp-4)] inline-block"
            style={{
              ...labelType,
              color: "var(--site-accent)",
              border: "1px solid var(--site-accent)",
              borderRadius: "2px",
              padding: "0.75rem 1.25rem",
            }}
          >
            {NAV.cta.label}
          </a>
        </div>
      </div>

      {/* hover ink shifts are instant on purpose: motion budget is
          transform and opacity only, so no color transitions.
          Reduced motion collapses every nav transition to an instant state
          change here in CSS, so server and client always render identical
          inline styles (see the hydration note at the top of the file).
          The sheet's closed translateY(-8px) is invisible under reduced
          motion: the sheet is opacity 0 + visibility hidden while closed
          and jumps straight to translateY(0) when opened. */}
      <style>{`
        .site-nav-link:hover { color: var(--site-fg); }
        .site-nav-cta:hover { background: var(--site-accent); color: var(--site-bg); }
        @media (prefers-reduced-motion: reduce) {
          .site-nav-anim { transition: none !important; }
        }
      `}</style>
    </header>
  );
}
