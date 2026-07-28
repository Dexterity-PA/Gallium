// The hairline divider, static. For the animated draw-on-entry variant use
// components/site/motion/RuleDraw.
export function SiteRule({
  strong = false,
  className = "",
}: {
  strong?: boolean;
  className?: string;
}) {
  return (
    <hr
      className={`border-0 ${className}`}
      style={{
        height: 1,
        background: strong ? "var(--site-rule-strong)" : "var(--site-rule)",
      }}
    />
  );
}
