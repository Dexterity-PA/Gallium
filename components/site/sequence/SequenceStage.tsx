"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  type MotionValue,
} from "framer-motion";
import { SectionHeader } from "@/components/site/primitives/Section";
import { Figure } from "@/components/site/primitives/Figure";
import { Reveal } from "@/components/site/motion/Reveal";
import { StatePane } from "./StatePane";
import type { SequenceData } from "./types";

// The one pinned sequence on the page. Three implementations share the same
// pane component and captions:
//
//   lg and up      a 200vh scroll track with a position: sticky stage; scroll
//                  progress crossfades three stacked states (opacity and a
//                  small y offset only, nothing that triggers layout). Scroll
//                  is never consumed or hijacked; past the track the page
//                  simply continues.
//   below lg       no pin. Three static states stacked in order, each with
//                  its caption, full opacity.
//   reduced motion no pin, no scroll mapping. State 3 only, with its caption.
//
// State timing over track progress p in [0, 1]:
//   state 1 holds to 0.30, fades out by 0.36
//   state 2 fades in 0.30..0.36, holds to 0.63, fades out by 0.69
//   state 3 fades in 0.63..0.69, holds to 1
// The CountUp figures in state 3 mount once p crosses 0.55 so the count
// runs as state 3 lands rather than finishing invisibly at page load.

interface StageProps {
  header: string;
  captions: readonly string[];
  closing: string;
  data: SequenceData;
}

const CAPTION: CSSProperties = {
  fontFamily: "var(--site-font-mono)",
  fontSize: "clamp(0.75rem, 0.71rem + 0.18vw, 0.875rem)",
  lineHeight: 1.65,
  letterSpacing: "0.01em",
  color: "var(--site-fg-dim)",
  maxWidth: "44ch",
};

const CAPTION_INDEX: CSSProperties = {
  fontFamily: "var(--site-font-mono)",
  fontSize: "var(--site-t-label)",
  letterSpacing: "var(--site-ls-label)",
  color: "var(--site-accent)",
};

// Sticky offset: clears the fixed SiteNav (condensed bar is under 3.25rem
// tall) plus breathing room.
const STICKY_TOP = "5rem";

// Keyframes over track progress for each of the three states. Every set
// spans the full 0..1 range explicitly: framer 12 hands these off to a
// WAAPI ViewTimeline animation, and WAAPI fills unspecified end offsets
// from the element's underlying inline style rather than clamping the way
// useTransform does, which renders wrong opacities past the last stop.
const KEYFRAMES = [
  {
    stops: [0, 0.3, 0.36, 1],
    opacity: [1, 1, 0, 0],
    y: [0, 0, -12, -12],
  },
  {
    stops: [0, 0.3, 0.36, 0.63, 0.69, 1],
    opacity: [0, 0, 1, 1, 0, 0],
    y: [14, 14, 0, 0, -12, -12],
  },
  {
    stops: [0, 0.63, 0.69, 1],
    opacity: [0, 0, 1, 1],
    y: [14, 14, 0, 0],
  },
] as const;

// One crossfading layer of the pinned stage. Each layer derives its own
// MotionValues from the shared progress value: a MotionValue must have
// exactly one subscribing motion component, or style application can
// cross-bind between subscribers (observed as state 1 and state 3 trading
// opacities after a mid-scroll re-render).
function StateLayer({
  progress,
  state,
  children,
}: {
  progress: MotionValue<number>;
  state: 0 | 1 | 2;
  children: ReactNode;
}) {
  const kf = KEYFRAMES[state];
  const opacity = useTransform(progress, [...kf.stops], [...kf.opacity]);
  const y = useTransform(progress, [...kf.stops], [...kf.y]);
  const pointerEvents = useTransform(opacity, (v) =>
    v > 0.5 ? ("auto" as const) : ("none" as const)
  );
  return (
    <motion.div
      data-sequence-layer
      className="col-start-1 row-start-1 min-w-0"
      style={{ opacity, y, pointerEvents }}
    >
      {children}
    </motion.div>
  );
}

function PinnedStage({
  header,
  captions,
  data,
}: Omit<StageProps, "closing">) {
  const trackRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });

  // Mount the state-3 CountUps only once the sequence is about to land on
  // them; once live, stays live (the count runs exactly once).
  const [live, setLive] = useState(false);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (v > 0.55) setLive(true);
  });

  return (
    <div
      ref={trackRef}
      data-sequence-track
      className="relative hidden lg:motion-safe:block"
      style={{ height: "200vh" }}
    >
      <div className="sticky" style={{ top: STICKY_TOP }}>
        <div
          className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start"
          style={{
            columnGap: "var(--site-sp-5)",
            // Center the stage in the pinned viewport instead of leaving
            // the space under the pane dead.
            minHeight: `calc(100vh - ${STICKY_TOP} - var(--site-sp-4))`,
            alignContent: "center",
          }}
        >
          <div>
            <SectionHeader>{header}</SectionHeader>
            <div className="relative grid" style={{ marginTop: "var(--site-sp-4)" }}>
              {([0, 1, 2] as const).map((state) => (
                <StateLayer key={state} progress={scrollYProgress} state={state}>
                  <div style={CAPTION_INDEX}>{`0${state + 1} / 03`}</div>
                  <p className="mt-2" style={CAPTION}>
                    {captions[state]}
                  </p>
                </StateLayer>
              ))}
            </div>
          </div>

          <Figure>
            <div className="grid">
              {([0, 1, 2] as const).map((state) => (
                <StateLayer key={state} progress={scrollYProgress} state={state}>
                  <StatePane
                    data={data}
                    state={state}
                    live={state === 2 ? live : true}
                  />
                </StateLayer>
              ))}
            </div>
          </Figure>
        </div>
      </div>
    </div>
  );
}

function StackedStage({
  header,
  captions,
  data,
}: Omit<StageProps, "closing">) {
  return (
    <div className="motion-safe:lg:hidden motion-reduce:hidden">
      <Reveal>
        <SectionHeader>{header}</SectionHeader>
      </Reveal>
      {([0, 1, 2] as const).map((state) => (
        <Reveal key={state} className="mt-[var(--site-sp-5)]">
          <Figure caption={captions[state]}>
            <StatePane data={data} state={state} live />
          </Figure>
        </Reveal>
      ))}
    </div>
  );
}

function ReducedStage({
  header,
  captions,
  data,
}: Omit<StageProps, "closing">) {
  return (
    <div className="hidden motion-reduce:block">
      <SectionHeader>{header}</SectionHeader>
      <div style={{ marginTop: "var(--site-sp-5)", maxWidth: "44rem" }}>
        <Figure caption={captions[2]}>
          <StatePane data={data} state={2} live />
        </Figure>
      </div>
    </div>
  );
}

function ClosingLine({ text }: { text: string }) {
  return (
    <Reveal className="mt-[var(--site-sp-5)]">
      <p
        style={{
          fontFamily: "var(--site-font-text)",
          fontSize: "clamp(1.3125rem, 1.1rem + 0.75vw, 1.75rem)",
          lineHeight: "var(--site-lh-heading)",
          fontWeight: 500,
          color: "var(--site-fg)",
          letterSpacing: "-0.005em",
          maxWidth: "38ch",
        }}
      >
        {text}
      </p>
    </Reveal>
  );
}

// Which of the three implementations shows is decided entirely by CSS
// (motion-safe / motion-reduce plus the lg breakpoint), never by a JS
// branch: the server cannot know the client's media queries, and a
// structural branch on useReducedMotion was a hydration mismatch under
// prefers-reduced-motion. All three render; exactly one is visible.
export function SequenceStage({ header, captions, closing, data }: StageProps) {
  return (
    <>
      <PinnedStage header={header} captions={captions} data={data} />
      <StackedStage header={header} captions={captions} data={data} />
      <ReducedStage header={header} captions={captions} data={data} />
      <ClosingLine text={closing} />
    </>
  );
}
