"use client";

// The app's signature motion (DESIGN.md §5). A single 1px --focus line sweeps
// top→bottom across a panel at 12% opacity over 600ms, then disappears.
// Render inside a `position: relative` container; bump `trigger` to replay.
export function Scanline({ trigger }: { trigger: number }) {
  if (!trigger) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <div
        key={trigger}
        className="absolute left-0 h-px w-full bg-focus"
        style={{ opacity: 0.12, animation: "scanline-sweep 600ms ease-out 1" }}
      />
    </div>
  );
}
