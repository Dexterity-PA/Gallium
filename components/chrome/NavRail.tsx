"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Left rail (DESIGN.md §4). Three-letter text labels, not icons: this is an
// instrument panel, and a three-letter code is read faster and more precisely
// than a glyph the viewer has to decode. Active item takes a 2px --focus left
// rule and --text-primary text, with no fill, so the rail stays flat against the
// panel plane. Route changes are instant, no page transition.

interface NavItem {
  href: string;
  code: string; // the rail label: three letters, --fs-label
  label: string; // the full screen name, for a11y and the tooltip
}

const ITEMS: NavItem[] = [
  // PRT sits above RDR because it is where the app lands after a BOM is
  // ingested: the product line first, then the event that hit one of them.
  { href: "/portfolio", code: "PRT", label: "PORTFOLIO" },
  { href: "/radar", code: "RDR", label: "RADAR" },
  { href: "/exposure", code: "EXP", label: "EXPOSURE" },
  { href: "/graph", code: "GRF", label: "GRAPH" },
  { href: "/resolve", code: "RSV", label: "RESOLVE" },
  { href: "/hindsight", code: "HND", label: "HINDSIGHT" },
];

export function NavRail() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-col items-stretch bg-panel"
      style={{ width: "var(--w-navrail)" }}
      aria-label="Primary"
    >
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            // square by construction: item height is bound to the rail width
            style={{ height: "var(--w-navrail)" }}
            className={[
              "label relative flex items-center justify-center border-b border-l-2 border-b-rule transition-colors",
              active
                ? "border-l-focus text-primary"
                : "border-l-transparent hover:text-secondary",
            ].join(" ")}
          >
            {item.code}
          </Link>
        );
      })}
    </nav>
  );
}
