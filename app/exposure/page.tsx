"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { BomLine } from "@/lib/types";
import { productFor } from "@/lib/data/products";
import { resolveFocusValue, useFocusedPart } from "@/lib/focus";
import { BomTable } from "@/components/exposure/BomTable";
import { PartDrawer } from "@/components/exposure/PartDrawer";
import { OwnershipDrawer } from "@/components/exposure/OwnershipDrawer";
import { FilterChips, type FilterKey } from "@/components/exposure/FilterChips";
import { Scanline } from "@/components/ui/Scanline";

// Why Gallium models three sub-tier inputs into a molded package and not the
// ten it physically contains. Shown only under the MODELED filter, where the
// question actually gets asked; a permanent legend would be answering it for
// a returning user who already knows.
const MODELED_DEPTH_NOTE =
  "Sub-tier inputs are modeled only where supply is concentrated enough to halt a line.";

// One predicate for "would this line be shown under this filter". Used both to
// derive the visible rows and to decide whether an externally focused row
// (⌘K palette, ?focus= deep link) needs the filter reset to ALL before the
// table can scroll it into view.
function matchesFilter(filter: FilterKey, b: BomLine): boolean {
  switch (filter) {
    case "EXPOSED":
      return b.status === "EXPOSED";
    case "TIER2":
      return b.tier >= 2;
    case "MODELED":
      return b.provenance === "MODELED";
    case "OWNERSHIP":
      return (b.ownership ?? "CLEAR") !== "CLEAR";
    default:
      return true;
  }
}

function ExposureScreen() {
  const params = useSearchParams();
  // The PORTFOLIO blotter opens each product here. No product, no problem:
  // productFor falls back to the focus product, so /exposure on its own is
  // still MD-7200 and every existing link keeps working.
  const product = productFor(params.get("product"));
  const lines = product.lines;

  // Command-palette / shared-focus deep link (?focus=MPN, see lib/focus)
  // opens that row's drawer, and it is present on the very first render, so
  // it seeds the selection rather than arriving late through an effect.
  // Exact match on MPN (the public currency) or line id (legacy links);
  // never fuzzy: an unknown value opens nothing.
  const focusId = params.get("focus");
  const lineFor = (id: string | null) => {
    if (!id) return null;
    const key = id.trim().toUpperCase();
    return lines.find((b) => b.mpn.toUpperCase() === key || b.id.toUpperCase() === key) ?? null;
  };

  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [selected, setSelected] = useState<BomLine | null>(() => lineFor(focusId));
  // Second, independent drawer for the ownership axis. Only one drawer is ever
  // open: opening one closes the other (see openSupplyPath / openOwnership).
  const [ownershipSelected, setOwnershipSelected] = useState<BomLine | null>(
    null
  );
  const [scan, setScan] = useState(0);

  // Reset during render, not from an effect. A different ?product= is a
  // different table, and it belongs to the render that carries it: an effect
  // would paint one frame of MD-9600's rows with MD-7200's drawer still open
  // over them. Same pattern OwnershipDrawer already uses for its source panel.
  // ?focus= is deliberately NOT part of this key anymore: same-product focus
  // changes flow through the shared focus context below, and a row click
  // writes ?focus= itself, which must not reset the filter under the click.
  const routeKey = product.code;
  const [appliedRoute, setAppliedRoute] = useState(routeKey);
  if (appliedRoute !== routeKey) {
    setAppliedRoute(routeKey);
    setFilter("ALL");
    setOwnershipSelected(null);
    setSelected(lineFor(focusId));
    setScan((n) => n + 1);
  }

  // ---- shared focused-part state (lib/focus) ------------------------------
  // Two-way sync. Outbound: openSupplyPath pushes a clicked row into the
  // shared state. Inbound: the render-time adjustment below applies a part
  // focused elsewhere (⌘K palette, ?focus= URL, another screen) by opening
  // its drawer; the table scrolls the row into view off the same selection
  // (see BomTable). Same reset-during-render pattern as routeKey above, so
  // an inbound focus never paints one frame with the previous drawer open.
  const { focusedPart, setFocusedPart, clearFocus } = useFocusedPart();

  // The shared focused part is always a line of the flagship BOM; it maps
  // onto this table only when that product is the one on screen.
  const focusedLine = useMemo(
    () =>
      focusedPart ? lines.find((b) => b.id === focusedPart.id) ?? null : null,
    [focusedPart, lines]
  );

  // appliedFocusId trails the last shared focus this screen has acted on.
  // It always starts null: a mount that already carries a shared focus
  // (navigating here from RADAR with a part focused) applies it on the first
  // render, and a ?focus= deep link, which the provider resolves in an
  // effect a commit after this screen seeds its own selection from the same
  // param, lands as a no-op because the seeded selection already matches.
  const focusedId = focusedLine?.id ?? null;
  const [appliedFocusId, setAppliedFocusId] = useState<string | null>(null);
  if (focusedId !== appliedFocusId) {
    setAppliedFocusId(focusedId);
    if (focusedLine) {
      // A part was focused elsewhere: open its drawer here.
      if (selected?.id !== focusedLine.id) {
        setOwnershipSelected(null);
        setSelected(focusedLine);
        // The focused row must actually be on screen to be scrolled to.
        if (!matchesFilter(filter, focusedLine)) setFilter("ALL");
      }
    } else if (!focusedPart && selected?.id === appliedFocusId) {
      // Focus was cleared somewhere else while that part's drawer is open
      // here; closing it keeps every screen telling the same story. Our own
      // close/clear paths null `selected` in the same event, so they land in
      // the no-op case. The !focusedPart guard keeps a product switch with a
      // still-focused flagship part (focusedLine null only because the lines
      // changed) from overriding routeKey's own selection reset above.
      setSelected(null);
    }
  }

  const counts = useMemo<Record<FilterKey, number>>(
    () => ({
      ALL: lines.length,
      EXPOSED: lines.filter((b) => b.status === "EXPOSED").length,
      TIER2: lines.filter((b) => b.tier >= 2).length,
      MODELED: lines.filter((b) => b.provenance === "MODELED").length,
      OWNERSHIP: lines.filter((b) => (b.ownership ?? "CLEAR") !== "CLEAR").length,
    }),
    [lines]
  );

  // The tier-2 ERP-blind catches on THIS product's BOM, reduced from the rows
  // rather than read off a constant scoped to the focus product.
  const tier2Catches = useMemo(
    () => lines.filter((b) => b.tier === 2 && b.erpBlind).length,
    [lines]
  );

  const rows = useMemo(
    () =>
      filter === "ALL" ? lines : lines.filter((b) => matchesFilter(filter, b)),
    [filter, lines]
  );

  // Opening either drawer closes the other, so only one is ever mounted-open.
  // A clicked row also becomes the shared focused part, but only when it
  // resolves in the shared namespace, i.e. it IS the flagship BOM line (id
  // match, not just MPN): pushing any other product's line into lib/focus
  // would be cleared straight back by the provider's URL resolver. Those rows
  // stay a local selection, and they drop any stale shared focus instead.
  const openSupplyPath = (b: BomLine) => {
    setOwnershipSelected(null);
    setSelected(b);
    if (resolveFocusValue(b.mpn)?.id === b.id) setFocusedPart(b);
    else if (focusedPart) clearFocus();
  };
  const openOwnership = (b: BomLine) => {
    setSelected(null);
    setOwnershipSelected(b);
    if (focusedPart) clearFocus();
  };
  const closeSupplyPath = () => {
    setSelected(null);
    if (focusedPart) clearFocus();
  };

  const changeFilter = (k: FilterKey) => {
    setFilter(k);
    setScan((s) => s + 1);
  };

  return (
    <div className="relative h-full">
      <section className="flex h-full min-h-0 flex-col bg-panel">
        {/* panel header */}
        <div
          className="flex h-row shrink-0 items-center justify-between border-b border-rule pl-2"
          style={{ paddingRight: "var(--safe-inset)" }}
        >
          <span className="label">
            Exposure · {product.code} bill of materials
          </span>
          <span className="text-label tabular-nums text-dim">
            {counts.ALL} LINES · {counts.EXPOSED} EXPOSED · {tier2Catches} TIER-2
            CATCHES
          </span>
        </div>

        {/* filter bar */}
        <div
          className="flex shrink-0 items-center justify-between gap-4 border-b border-rule pl-2 py-1"
          style={{ paddingRight: "var(--safe-inset)" }}
        >
          <FilterChips value={filter} onChange={changeFilter} counts={counts} />
          {filter === "MODELED" ? (
            <span className="label truncate" style={{ color: "var(--modeled)" }}>
              {MODELED_DEPTH_NOTE}
            </span>
          ) : null}
        </div>

        {/* table */}
        <div className="relative min-h-0 flex-1">
          <BomTable
            rows={rows}
            selectedId={selected?.id ?? null}
            onSelect={openSupplyPath}
            onSelectOwnership={openOwnership}
          />
          <Scanline trigger={scan} />
        </div>
      </section>

      <PartDrawer line={selected} onClose={closeSupplyPath} />
      <OwnershipDrawer
        line={ownershipSelected}
        onClose={() => setOwnershipSelected(null)}
      />
    </div>
  );
}

// useSearchParams suspends during a production prerender, so the screen sits
// behind a boundary (next/docs: use-search-params, "Prerendering"). The
// fallback is null rather than a skeleton: this route only ever renders once
// a BOM is loaded and AppShell has already gated it, so a flash of scaffolding
// would be a frame of chrome nobody asked for.
export default function ExposurePage() {
  return (
    <Suspense fallback={null}>
      <ExposureScreen />
    </Suspense>
  );
}
