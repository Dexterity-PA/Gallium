"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { BomLine } from "@/lib/types";
import { productFor } from "@/lib/data/products";
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

function ExposureScreen() {
  const params = useSearchParams();
  // The PORTFOLIO blotter opens each product here. No product, no problem:
  // productFor falls back to the focus product, so /exposure on its own is
  // still MD-7200 and every existing link keeps working.
  const product = productFor(params.get("product"));
  const lines = product.lines;

  // Command-palette deep link (?focus=BOM-07) opens that row's drawer, and it
  // is present on the very first render, so it seeds the selection rather than
  // arriving late through an effect.
  const focusId = params.get("focus");
  const lineFor = (id: string | null) =>
    id ? (lines.find((b) => b.id === id) ?? null) : null;

  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [selected, setSelected] = useState<BomLine | null>(() => lineFor(focusId));
  // Second, independent drawer for the ownership axis. Only one drawer is ever
  // open: opening one closes the other (see openSupplyPath / openOwnership).
  const [ownershipSelected, setOwnershipSelected] = useState<BomLine | null>(
    null
  );
  const [scan, setScan] = useState(0);

  // Reset during render, not from an effect. A different ?product= is a
  // different table and a different ?focus= is a different selection, and both
  // belong to the render that carries them: an effect would paint one frame of
  // MD-9600's rows with MD-7200's drawer still open over them. Same pattern
  // OwnershipDrawer already uses for its source panel.
  const routeKey = `${product.code}|${focusId ?? ""}`;
  const [appliedRoute, setAppliedRoute] = useState(routeKey);
  if (appliedRoute !== routeKey) {
    setAppliedRoute(routeKey);
    setFilter("ALL");
    setOwnershipSelected(null);
    setSelected(lineFor(focusId));
    setScan((n) => n + 1);
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

  const rows = useMemo(() => {
    switch (filter) {
      case "EXPOSED":
        return lines.filter((b) => b.status === "EXPOSED");
      case "TIER2":
        return lines.filter((b) => b.tier >= 2);
      case "MODELED":
        return lines.filter((b) => b.provenance === "MODELED");
      case "OWNERSHIP":
        return lines.filter((b) => (b.ownership ?? "CLEAR") !== "CLEAR");
      default:
        return lines;
    }
  }, [filter, lines]);

  // Opening either drawer closes the other, so only one is ever mounted-open.
  const openSupplyPath = (b: BomLine) => {
    setOwnershipSelected(null);
    setSelected(b);
  };
  const openOwnership = (b: BomLine) => {
    setSelected(null);
    setOwnershipSelected(b);
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

      <PartDrawer line={selected} onClose={() => setSelected(null)} />
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
