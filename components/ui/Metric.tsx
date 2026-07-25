// Large metric readout (DESIGN.md §3 type scale). Presentational — callers
// pass an already-formatted (and, where wanted, already-tweened) value node.
//
// Label / value / sub is the canonical label-row treatment: the label is
// --fs-label + --text-dim (the indivisible `.label`), the value is the only
// thing allowed to carry size or an accent, and the sub is --fs-label again.
// The label never competes with the number it names.

interface MetricProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  size?: "xl" | "lg";
  tone?: string; // CSS color for the value
  className?: string;
}

export function Metric({
  label,
  value,
  sub,
  size = "xl",
  tone = "var(--text-primary)",
  className = "",
}: MetricProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="label">{label}</div>
      <div
        className="tabular-nums leading-none"
        style={{
          color: tone,
          // `lg` has no token: the scale steps from --fs-value (13px) straight
          // to --fs-hero (34px). Left literal rather than invented — RADAR and
          // RESOLVE use `xl` only; `lg` survives for the entry screen.
          fontSize: size === "xl" ? "var(--fs-hero)" : "20px",
          fontWeight: 500,
          letterSpacing: size === "xl" ? "-0.02em" : "-0.01em",
        }}
      >
        {value}
      </div>
      {sub ? <div className="label tabular-nums">{sub}</div> : null}
    </div>
  );
}
