// Plain serializable shapes passed from the server section
// (components/site/sections/ProductSequence.tsx) into the client sequence
// components. Deliberately no lib/ imports: the data layer and its
// module-load guards stay out of the client bundle; the section derives
// everything server-side and hands over primitives only.

export interface SequencePart {
  /** BOM line id, e.g. "BOM-07". */
  bomId: string;
  /** Product line the BOM belongs to, e.g. "MD-7200". */
  productLine: string;
  mpn: string;
  manufacturer: string;
  description: string;
  /** The ERP's country-of-origin code as recorded, e.g. "USA". */
  erpOrigin: string;
  /** Long-form rendering of erpOrigin for the pane row. */
  erpOriginDisplay: string;
  qtyPerUnit: number;
  unitCost: number;
  leadTimeWeeks: number;
  leadTimeDelta: number;
  confidence: number;
  /** Wafer fab site from the supply path, when the path records one. */
  fabSite: string | null;
  /** Backend assembly & test site, e.g. "Kaohsiung, TW". */
  backendSite: string;
  backendProvenance: string;
  backendInQuarantineZone: boolean;
}

export interface SequenceSource {
  id: string;
  title: string;
}

export interface SequenceExposure {
  exposed: number;
  total: number;
  /** Dollars, raw. */
  buildAtRisk: number;
  /** The locked rendering, e.g. "$2.8M". */
  buildAtRiskLabel: string;
  daysToHalt: number;
}

export interface SequenceData {
  part: SequencePart;
  source: SequenceSource;
  exposure: SequenceExposure;
}
