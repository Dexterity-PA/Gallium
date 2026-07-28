import { PRODUCT_SEQUENCE } from "@/lib/site/content";
import { BOM, CENTERPIECE_ID } from "@/lib/data/bom";
import { SOURCES } from "@/lib/data/sources";
import { CUSTOMER } from "@/lib/data/customer";
import { baselineImpact } from "@/lib/derive/impact";
import { Section } from "@/components/site/primitives/Section";
import { SequenceStage } from "@/components/site/sequence/SequenceStage";
import type { SequenceData } from "@/components/site/sequence/types";

// Section 04, PRODUCT. The one pinned sequence on the page: the heading
// holds while the pane beside it advances through three states on scroll.
//
// Server component. Everything the panes show is read out of the data layer
// here, at render time, and handed to the client sequence as plain props:
//   the part        BOM's exported CENTERPIECE_ID line (the ERP-blind
//                   isolated gate driver), its MPN, declared origin, and
//                   supply path
//   the site        the line's BACKEND A&T stage (Kaohsiung, TW)
//   the citation    the IMPORT_RECORD source the line itself carries
//   the exposure    baselineImpact(), the same guard-enforced derivation
//                   the product screens read (14 of 31, $2.8M, 51 days)
// Nothing numeric is authored in this file; if the data layer moves, this
// section moves with it or throws at render rather than showing a stale
// figure.

// Presentation-only mapping from the ERP's country code to the long form the
// pane row displays. The underlying value stays line.erpOrigin.
const ORIGIN_DISPLAY: Record<string, string> = {
  USA: "United States",
};

function deriveSequenceData(): SequenceData {
  const line = BOM.find((b) => b.id === CENTERPIECE_ID);
  if (line === undefined) {
    throw new Error(
      `ProductSequence: centerpiece line ${CENTERPIECE_ID} missing from BOM`
    );
  }

  const backend = line.supplyPath?.find((s) => s.stage === "BACKEND A&T");
  if (backend === undefined) {
    throw new Error(
      `ProductSequence: ${line.id} carries no BACKEND A&T supply path stage`
    );
  }
  const fab = line.supplyPath?.find((s) => s.stage === "WAFER FAB");

  const source = SOURCES.find(
    (s) => s.kind === "IMPORT_RECORD" && line.sourceIds.includes(s.id)
  );
  if (source === undefined) {
    throw new Error(
      `ProductSequence: ${line.id} cites no IMPORT_RECORD source`
    );
  }

  const impact = baselineImpact();
  // The pane's CountUp formats the raw dollars with the same expression as
  // lib/derive/impact.ts buildAtRiskLabel; if the two ever disagree, fail
  // the render instead of shipping a figure that differs from the product.
  const landed = `$${(impact.buildAtRisk / 1_000_000).toFixed(1)}M`;
  if (landed !== impact.buildAtRiskLabel) {
    throw new Error(
      `ProductSequence: CountUp landing "${landed}" disagrees with derived label "${impact.buildAtRiskLabel}"`
    );
  }

  return {
    part: {
      bomId: line.id,
      productLine: CUSTOMER.focusProduct.line,
      mpn: line.mpn,
      manufacturer: line.manufacturer,
      description: line.description,
      erpOrigin: line.erpOrigin,
      erpOriginDisplay: ORIGIN_DISPLAY[line.erpOrigin] ?? line.erpOrigin,
      qtyPerUnit: line.qtyPerUnit,
      unitCost: line.unitCost,
      leadTimeWeeks: line.leadTimeWeeks,
      leadTimeDelta: line.leadTimeDelta,
      confidence: line.confidence,
      fabSite: fab?.site ?? null,
      backendSite: backend.site,
      backendProvenance: backend.provenance,
      backendInQuarantineZone: backend.inQuarantineZone,
    },
    source: { id: source.id, title: source.title },
    exposure: {
      exposed: impact.bomLinesExposed,
      total: impact.bomLinesTotal,
      buildAtRisk: impact.buildAtRisk,
      buildAtRiskLabel: impact.buildAtRiskLabel,
      daysToHalt: impact.daysToHalt,
    },
  };
}

export default function ProductSequence() {
  const data = deriveSequenceData();
  return (
    <Section
      id="product"
      ordinal={PRODUCT_SEQUENCE.ordinal}
      eyebrow={PRODUCT_SEQUENCE.eyebrow}
    >
      <SequenceStage
        header={PRODUCT_SEQUENCE.header}
        captions={PRODUCT_SEQUENCE.states.map((s) => s.caption)}
        closing={PRODUCT_SEQUENCE.closing}
        data={data}
      />
    </Section>
  );
}
