// Shared type contract for the Gallium demo build.
// Schemas mirror DATA.md §4–§8. Every data module is typed against this.

export type Tier = 1 | 2 | 3;
export type Status = "CLEAR" | "AT_RISK" | "EXPOSED";
export type Provenance = "OBSERVED" | "MODELED";
export type Severity = "INFO" | "WARN" | "CRITICAL";

export type SupplyStage =
  | "WAFER FAB"
  | "BACKEND A&T"
  | "DISTRIBUTION"
  | "SUBSTRATE"
  | "TEST";

export interface SupplyPathNode {
  stage: SupplyStage;
  site: string;
  provenance: Provenance;
  inQuarantineZone: boolean;
}

export interface BomLine {
  id: string;
  mpn: string;
  description: string;
  manufacturer: string;
  erpOrigin: string; // what the customer's ERP believes
  actualExposure: string | null; // where the real exposure sits
  tier: Tier;
  status: Status;
  provenance: Provenance;
  confidence: number; // a ConfidenceBand value — see lib/data/confidence.ts
  sourceIds: string[]; // → SourceDoc.id in lib/data/sources.ts (never empty)
  leadTimeWeeks: number;
  leadTimeDelta: number; // change vs prior quote
  qtyPerUnit: number;
  unitCost: number;
  erpBlind: boolean; // true when erpOrigin misleads
  supplyPath?: SupplyPathNode[];
  // ---- compliance / ownership axis (independent of logistics exposure) ----
  ownership?: OwnershipStatus; // affiliates-screening posture, defaults CLEAR
  ownershipChain?: OwnershipChain; // detail behind a REVIEW/FLAGGED cell
}

// ---- ownership chain (compliance axis) ---------------------
// The affiliates-screening / 50%-threshold view of a supplier. Deliberately
// separate from logistics `status`: a part can be quarantine-CLEAR yet
// ownership-FLAGGED, and vice versa — that independence is the point.

export type OwnershipStatus = "CLEAR" | "REVIEW" | "FLAGGED";

export interface OwnershipChain {
  supplierOfRecord: string; // OBSERVED
  parentEntity: string; // OBSERVED
  parentPct: number; // e.g. 62
  ultimateParent: string; // MODELED (violet in the drawer)
  ultimateParentConf: number; // modeled ConfidenceBand value — see confidence.ts
  thresholdCrossed: boolean; // crosses the 50% affiliates threshold
  sourceIds: string[]; // → SourceDoc.id (registry / import / disclosure docs)
}

// ---- graph (DATA.md §5) ------------------------------------

export type GraphNodeKind =
  | "CUSTOMER"
  | "BOM"
  | "SUPPLIER"
  | "FAB"
  | "BACKEND"
  | "LOGISTICS";

export interface GraphNode {
  id: string;
  label: string;
  kind: GraphNodeKind;
  ring: 0 | 1 | 2 | 3;
  status: Status;
  provenance: Provenance;
  exposureValue: number; // drives node radius
  sourceIds: string[]; // → SourceDoc.id
  lat?: number;
  lng?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  provenance: Provenance;
  confidence: number; // a ConfidenceBand value — see confidence.ts
  sourceIds: string[]; // → SourceDoc.id
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ---- map (DATA.md §6) --------------------------------------

export interface Site {
  id: string;
  label: string;
  lat: number;
  lng: number;
  exposed: boolean;
  isCustomer?: boolean;
  function?: string;
  sourceIds: string[]; // → SourceDoc.id
}

// ---- event feed (DATA.md §2) -------------------------------

export interface FeedEvent {
  t: string; // wall-clock label, e.g. "14:31:58"
  sev: Severity;
  head: string;
  body: string;
  sourceIds: string[]; // → SourceDoc.id (never empty)
  confidence: number; // a ConfidenceBand value — see lib/data/confidence.ts
  arrivesAtMs?: number; // if set, streams in during the demo
  isPrimary?: boolean;
}

// ---- ticker (DATA.md §7) -----------------------------------

export type TickerDir = "up" | "down";

export interface TickerItem {
  label: string;
  value: string;
  delta?: string;
  dir: TickerDir;
  critical?: boolean;
}

// ---- resolution actions (DATA.md §8) -----------------------

export type ActionKind = "EXPEDITE" | "SUBSTITUTE" | "BUY_AHEAD" | "LICENSE";

export interface ActionMetric {
  label: string;
  value: string;
  note?: string;
  warn?: boolean;
}

export interface Action {
  id: string;
  kind: ActionKind;
  title: string;
  recovers: number;
  /**
   * Canonical action → BOM-line mapping: the exact MPN/line ids this action
   * recovers. Length must equal `recovers`, and across all actions these sum
   * to the 11 OBSERVED exposed lines (6 + 3 + 2) with no line double-covered.
   * The RESOLVE left-rail state, card cross-highlighting, and the impact
   * rollup all derive from this. See components/resolve/rollup.ts.
   */
  covers: string[];
  rationale: string;
  metrics: ActionMetric[];
  warning?: string;
  cta: string;
}

// ---- impact summary (DATA.md §3) ---------------------------

export interface Impact {
  bomLinesExposed: number;
  bomLinesTotal: number;
  buildAtRisk: number;
  buildAtRiskLabel: string;
  daysToHalt: number;
  tier2Catches: number;
}

// ---- provenance documents (sourceIds target) ----------------
// The record every `sourceIds: string[]` points at. Agent A fills the corpus;
// this interface is the contract a real document store would implement.

export type SourceKind =
  | "CUSTOMS_NOTICE"
  | "PORT_STATUS"
  | "ERP_EXPORT"
  | "PROCUREMENT"
  | "DISTRIBUTOR"
  | "IMPORT_RECORD"
  | "CORP_REGISTRY"
  | "MARKET_DATA"
  | "CARRIER_ADVISORY"
  | "REGULATORY"
  | "NETWORK_INFERENCE"; // the modeled tier — sources that are themselves derived

export interface SourceDoc {
  id: string; // e.g. "SRC-KHH-CUSTOMS"
  kind: SourceKind;
  title: string;
  publisher: string; // issuing body / feed name
  provenance: Provenance; // OBSERVED for real docs, MODELED for inferences
  retrievedAt: string; // ISO 8601
  url?: string; // present for public sources; omitted for first-party/internal
  excerpt?: string; // short pull-quote (Agent A fills)
}

// ---- MPN lookup (backs upload resolution) -------------------
// A customer uploads a BOM; each row's MPN is resolved against this table to
// recover the true origin/exposure the customer's ERP cannot see. The interface
// a real parts-intelligence backend would implement.

export interface ComponentRecord {
  mpn: string;
  manufacturer: string;
  description: string;
  category: string; // e.g. "IGBT module", "MCU", "passive"
  canonicalOrigin: string; // wafer-fab country the ERP would show
  assemblyRegion: string | null; // real backend A&T region (the blind spot)
  provenance: Provenance;
  confidence: number; // ConfidenceBand value
  sourceIds: string[];
}

// ---- scenario definition ------------------------------------
// The single source of truth for the scripted quarantine scenario. Consolidates
// facts otherwise scattered across customer/event/ticker so a live-data swap
// changes one definition, not five.

export interface ScenarioZone {
  lat: number;
  lng: number;
  radiusKm: number;
  polygon: Array<[number, number]>; // [lng, lat]
}

export interface Scenario {
  id: string;
  fictional: true; // labeled as such in the video; never rendered as real
  title: string;
  asOf: string; // ISO 8601 — the "now" the demo freezes at
  customerName: string;
  focusProduct: string;
  primaryEventId: string;
  zone: ScenarioZone;
  complianceRuleEffective: string; // affiliates-screening resumption date
  summary: string;
}

// ---- news articles (Agent D fills) --------------------------

export interface Article {
  id: string;
  headline: string;
  outlet: string; // fictional outlet name
  publishedAt: string; // ISO 8601
  dek: string; // standfirst / subhead
  body?: string; // full text (Agent D fills)
  sourceIds: string[]; // documents the article draws on
  relatedBomIds?: string[]; // BOM lines this article contextualizes
  fictional: true;
}
