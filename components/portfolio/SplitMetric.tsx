import { Metric } from "@/components/ui/Metric";

/* ============================================================
   A rollup figure with two tiers of knowledge behind it.

   LINES EXPOSED and VALUE AT RISK are each part observed and part
   inferred, and adding the two together is the single least honest thing
   this screen could do. Six of seven products have no ingested BOM, so a
   combined total is mostly supplier-level screening presented at hero
   size as a fact, and it lands in the same frame as an alert band quoting
   the confirmed figure. One of the two numbers then has to be wrong.

   So the confirmed figure IS the number: hero size, and the incident
   colour when there is an incident. The screened estimate sits beside it
   at --fs-value in --modeled, which is exactly what tokens.css RULE 2
   reserves that colour for (inferred, derived, not directly observed).
   The size ratio does the rest: a viewer who reads only the big number
   has read only what the resolved BOM actually says.
   ============================================================ */

export function SplitMetric({
  label,
  confirmed,
  screened,
  sub,
  tone,
  className = "",
}: {
  label: string;
  /** The observed figure. Gets the weight. */
  confirmed: string;
  /** The inferred figure, already carrying its estimate mark. */
  screened: string;
  sub: string;
  tone: string;
  className?: string;
}) {
  return (
    <Metric
      label={label}
      className={className}
      tone={tone}
      value={
        <span className="flex items-baseline gap-2">
          <span>{confirmed}</span>
          {/* letter-spacing is reset: Metric tracks the hero figure in
              tight, which is wrong for 13px text riding beside it. */}
          <span
            className="text-value"
            style={{ color: "var(--modeled)", letterSpacing: "0" }}
          >
            + {screened} screened
          </span>
        </span>
      }
      sub={sub}
    />
  );
}
