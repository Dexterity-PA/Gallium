"use client";

import { FEED_EVENTS } from "@/lib/data/event";
import { useReducedMotionSafe } from "@/components/site/motion/useReducedMotionSafe";

// The honest version of a logo marquee: instead of borrowed logos, the band
// under the hero runs the product's own event feed. Every headline below is a
// real `head` string from lib/data/event.ts, verbatim; nothing here is
// marketing copy pretending to be data.
const HEADLINES: string[] = FEED_EVENTS.map((e) => e.head);

// Slow and linear, scaled to how much text is actually in the loop so adding
// a feed row later does not speed the band up. Roughly 5.5 characters per
// second lands a ~350 character track at just over a minute per revolution.
const TRACK_CHARS = HEADLINES.join(" / ").length;
const DURATION_S = Math.round(TRACK_CHARS / 5.5);

// One copy of the track. The internal gap and the trailing padding are the
// same value on purpose: the seam between the visible copy and its aria-hidden
// duplicate must measure exactly like the gap between two headlines inside a
// copy, or the -50% loop point shows a stutter.
function Track({ hidden = false }: { hidden?: boolean }) {
  return (
    <div
      aria-hidden={hidden || undefined}
      className="flex w-max flex-none items-baseline gap-x-10 pr-10"
    >
      {HEADLINES.map((head, i) => (
        <span key={i} className="flex items-baseline gap-x-10 whitespace-nowrap">
          <span>{head}</span>
          <span aria-hidden="true" className="text-[var(--site-accent)]">
            /
          </span>
        </span>
      ))}
    </div>
  );
}

// A slow horizontal band of real event headlines, directly under the hero.
// Hairline rules above and below, mono at label size, one continuous
// translateX loop over a duplicated track. Hover or keyboard focus pauses it
// (animation-play-state via the .evt-marquee CSS below); the band itself is
// focusable so keyboard users can stop the motion without the headlines
// needing to be links. Reduced motion renders a single static row, clipped.
export default function EventMarquee() {
  const reducedMotion = useReducedMotionSafe();

  return (
    <section
      aria-label="Live signals from the Gallium event feed"
      className="w-full border-y py-4"
      style={{ borderColor: "var(--site-rule)" }}
    >
      <div
        tabIndex={0}
        aria-label={
          reducedMotion
            ? "Event feed headlines"
            : "Scrolling event feed headlines. Hover or focus to pause."
        }
        className="evt-marquee w-full overflow-hidden focus-visible:outline-none"
        style={{
          fontFamily: "var(--site-font-mono)",
          fontSize: "var(--site-t-label)",
          letterSpacing: "var(--site-ls-label)",
          color: "var(--site-fg-dim)",
          lineHeight: 1.6,
        }}
      >
        {reducedMotion ? (
          <Track />
        ) : (
          <div
            className="evt-marquee-track flex w-max"
            style={{ "--evt-marquee-duration": `${DURATION_S}s` } as React.CSSProperties}
          >
            <Track />
            <Track hidden />
          </div>
        )}
      </div>

      {/* Plain global style, scoped by the evt-marquee class prefix. Transform
          only, per the site motion rules; the loop point is exactly -50%
          because the track is two identical copies laid end to end. The
          animation lives here rather than in an inline style so the paused
          play-state below can actually win; an inline animation shorthand
          would out-rank every one of these rules. */}
      <style>{`
        @keyframes evt-marquee-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .evt-marquee-track {
          animation: evt-marquee-scroll var(--evt-marquee-duration, 60s) linear infinite;
        }
        .evt-marquee:hover .evt-marquee-track,
        .evt-marquee:focus-within .evt-marquee-track,
        .evt-marquee:focus .evt-marquee-track {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}
