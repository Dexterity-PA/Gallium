"use client";

import { useEffect, useMemo, useState } from "react";
import type { BomLine } from "@/lib/types";
import { BOM } from "@/lib/data/bom";
import { TIER2_CATCHES } from "@/lib/data/actions";
import { CUSTOMER } from "@/lib/data/customer";
import { BomTable } from "@/components/exposure/BomTable";
import { PartDrawer } from "@/components/exposure/PartDrawer";
import { OwnershipDrawer } from "@/components/exposure/OwnershipDrawer";
import { FilterChips, type FilterKey } from "@/components/exposure/FilterChips";
import { Scanline } from "@/components/ui/Scanline";

export default function ExposurePage() {
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [selected, setSelected] = useState<BomLine | null>(null);
  // Second, independent drawer for the ownership axis. Only one drawer is ever
  // open: opening one closes the other (see openSupplyPath / openOwnership).
  const [ownershipSelected, setOwnershipSelected] = useState<BomLine | null>(
    null
  );
  const [scan, setScan] = useState(0);

  const counts = useMemo<Record<FilterKey, number>>(
    () => ({
      ALL: BOM.length,
      EXPOSED: BOM.filter((b) => b.status === "EXPOSED").length,
      TIER2: BOM.filter((b) => b.tier >= 2).length,
      MODELED: BOM.filter((b) => b.provenance === "MODELED").length,
      // non-CLEAR ownership rows (5 REVIEW + 2 FLAGGED) → 7.
      OWNERSHIP: BOM.filter((b) => (b.ownership ?? "CLEAR") !== "CLEAR").length,
    }),
    []
  );

  const rows = useMemo(() => {
    switch (filter) {
      case "EXPOSED":
        return BOM.filter((b) => b.status === "EXPOSED");
      case "TIER2":
        return BOM.filter((b) => b.tier >= 2);
      case "MODELED":
        return BOM.filter((b) => b.provenance === "MODELED");
      case "OWNERSHIP":
        return BOM.filter((b) => (b.ownership ?? "CLEAR") !== "CLEAR");
      default:
        return BOM;
    }
  }, [filter]);

  // Opening either drawer closes the other, so only one is ever mounted-open.
  const openSupplyPath = (b: BomLine) => {
    setOwnershipSelected(null);
    setSelected(b);
  };
  const openOwnership = (b: BomLine) => {
    setSelected(null);
    setOwnershipSelected(b);
  };

  // Command-palette deep link (?focus=BOM-07) opens that row's drawer.
  useEffect(() => {
    const focus = new URLSearchParams(window.location.search).get("focus");
    if (focus) {
      const line = BOM.find((b) => b.id === focus);
      if (line) setSelected(line);
    }
  }, []);

  const changeFilter = (k: FilterKey) => {
    setFilter(k);
    setScan((s) => s + 1);
  };

  return (
    <div className="relative h-full">
      <section className="flex h-full min-h-0 flex-col bg-panel">
        {/* panel header */}
        <div className="flex h-row shrink-0 items-center justify-between border-b border-rule px-2">
          <span className="label">
            Exposure — {CUSTOMER.focusProduct.line} bill of materials
          </span>
          <span className="text-label tabular-nums text-dim">
            {counts.ALL} LINES · {counts.EXPOSED} EXPOSED · {TIER2_CATCHES} TIER-2 CATCHES
          </span>
        </div>

        {/* filter bar */}
        <div className="flex shrink-0 items-center border-b border-rule px-2 py-1">
          <FilterChips value={filter} onChange={changeFilter} counts={counts} />
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
