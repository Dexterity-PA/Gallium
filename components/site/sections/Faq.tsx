"use client";

import { useId, useState } from "react";
import { FAQ } from "@/lib/site/content";
import { Section, SectionHeader } from "@/components/site/primitives/Section";
import { Prose } from "@/components/site/primitives/Prose";
import { Reveal } from "@/components/site/motion/Reveal";
import { useReducedMotionSafe } from "@/components/site/motion/useReducedMotionSafe";

// FAQ accordion. One item open at a time; the panel animates via
// grid-template-rows (0fr to 1fr) with an overflow-hidden inner track,
// which is the sanctioned technique on this site (no height animation).
// Reduced motion snaps open and closed with no transition.

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

function PlusIndicator({
  open,
  reduced,
}: {
  open: boolean;
  reduced: boolean;
}) {
  const bar = {
    position: "absolute" as const,
    left: 0,
    top: "50%",
    width: "100%",
    height: 1,
    background: "var(--site-fg-dim)",
  };
  return (
    <span
      aria-hidden
      className="relative shrink-0"
      style={{
        width: "0.875rem",
        height: "0.875rem",
        // The whole glyph rotates 45deg when open, turning + into x.
        transform: open ? "rotate(45deg)" : "rotate(0deg)",
        transition: reduced ? "none" : `transform 250ms ${EASE}`,
      }}
    >
      <span style={{ ...bar, transform: "translateY(-50%)" }} />
      <span
        style={{ ...bar, transform: "translateY(-50%) rotate(90deg)" }}
      />
    </span>
  );
}

function FaqItem({
  q,
  a,
  open,
  onToggle,
  idBase,
  reduced,
}: {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
  idBase: string;
  reduced: boolean;
}) {
  const buttonId = `${idBase}-q`;
  const panelId = `${idBase}-a`;
  return (
    <div style={{ borderTop: "1px solid var(--site-rule)" }}>
      <h3 className="m-0">
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full cursor-pointer items-center justify-between gap-4 text-left"
          style={{
            background: "none",
            border: 0,
            padding: "var(--site-sp-3) 0",
            fontFamily: "var(--site-font-text)",
            fontSize: "var(--site-t-body)",
            lineHeight: "var(--site-lh-heading)",
            fontWeight: 500,
            color: "var(--site-fg)",
          }}
        >
          <span>{q}</span>
          <PlusIndicator open={open} reduced={reduced} />
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className="grid"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: reduced
            ? "none"
            : `grid-template-rows 250ms ${EASE}`,
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            style={{
              paddingBottom: "var(--site-sp-3)",
              opacity: open ? 1 : 0,
              transition: reduced ? "none" : `opacity 250ms ${EASE}`,
            }}
          >
            <Prose dim>{a}</Prose>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Faq() {
  const reduced = useReducedMotionSafe();
  const idBase = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <Section eyebrow={FAQ.eyebrow}>
      <Reveal>
        <SectionHeader>{FAQ.header}</SectionHeader>
      </Reveal>
      <Reveal amount={0.1} className="mt-[var(--site-sp-4)]">
        <div style={{ borderBottom: "1px solid var(--site-rule)" }}>
          {FAQ.items.map((item, i) => (
            <FaqItem
              key={item.q}
              q={item.q}
              a={item.a}
              open={openIndex === i}
              onToggle={() =>
                setOpenIndex((prev) => (prev === i ? null : i))
              }
              idBase={`${idBase}-${i}`}
              reduced={reduced}
            />
          ))}
        </div>
      </Reveal>
    </Section>
  );
}
