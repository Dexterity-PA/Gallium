import type { SourceDoc } from "@/lib/types";
import { BOM } from "@/lib/data/bom";
import { PRODUCTS } from "@/lib/data/products";
import { FEED_EVENTS, PRIMARY_EVENT } from "@/lib/data/event";
import { SITES } from "@/lib/data/sites";
import { GRAPH } from "@/lib/data/graph";

// Provenance document corpus: the target of every `sourceIds: string[]`.
//
// STUB: Agent A owns the rich content (full titles, real-looking excerpts,
// public URLs). What must stay stable is the id set and each doc's `kind` /
// `provenance`, because records across the data layer reference these ids and
// the integrity guard below fails the build on any dangling reference. Add
// documents freely; do not silently rename or delete an id that records use.
//
// Provenance: OBSERVED docs are first-party or externally published; MODELED
// docs are themselves inferences (the network-inference tier) and are why a
// record can be MODELED. First-party docs (our ERP / procurement) carry no url.
export const SOURCES: SourceDoc[] = [
  {
    id: "SRC-KHH-CUSTOMS",
    kind: "CUSTOMS_NOTICE",
    title: "Outbound container inspection regime: Kaohsiung & adjacent anchorages",
    publisher: "PRC General Administration of Customs (bulletin)",
    provenance: "OBSERVED",
    retrievedAt: "2026-07-22T14:31:58Z",
    url: "https://example.gov.stub/customs/khh-2026-0722",
    excerpt:
      "Effective 0600 local, outbound container traffic from Kaohsiung and adjacent anchorages is subject to mandatory inspection hold prior to release. Backend assembly and test shipments originating within the designated zone fall within scope regardless of declared country of origin on the commercial invoice.",
  },
  {
    id: "SRC-PORT-KHH",
    kind: "PORT_STATUS",
    title: "Berth status & vessel holding, Port of Kaohsiung",
    publisher: "Taiwan International Ports Corp (status feed)",
    provenance: "OBSERVED",
    retrievedAt: "2026-07-22T14:30:00Z",
    url: "https://example.stub/ports/khh/status",
    excerpt:
      "Berth utilization at Kaohsiung terminals 68/69 has fallen to 41% of nominal as vessels hold at anchorage pending customs clearance. Average dwell time is up 6.2 days week-over-week.",
  },
  {
    id: "SRC-ERP-MERIDIAN",
    kind: "ERP_EXPORT",
    title: "MD-7200 bill of materials, ERP export",
    publisher: "Meridian Drive Systems (first-party)",
    provenance: "OBSERVED",
    retrievedAt: "2026-07-22T13:00:00Z",
    excerpt:
      "Line BOM-07 (MPN ISO5852SDW): Country of Origin = UNITED STATES. Field is populated from vendor master data captured at qualification and reflects wafer fabrication site only. No subordinate assembly or test location is tracked downstream of the fab.",
  },
  {
    id: "SRC-PROC-MERIDIAN",
    kind: "PROCUREMENT",
    title: "Purchase orders & supplier acknowledgements, MD-7200",
    publisher: "Meridian Drive Systems (first-party)",
    provenance: "OBSERVED",
    retrievedAt: "2026-07-22T13:05:00Z",
    excerpt:
      "PO acknowledgement lists ship-from as Texas Instruments, Dallas, TX for MPN ISO5852SDW. No downstream subcontract assembly or test location is disclosed on the supplier acknowledgement.",
  },
  {
    id: "SRC-DIST-ALLOC",
    kind: "DISTRIBUTOR",
    title: "Authorized-channel allocation & routing notices",
    // STALE 14M rides in the publisher line because that is where the panel
    // renders freshness (publisher · kind · retrievedAt). This feed stopped
    // returning fourteen minutes before the scenario clock, and the parts it
    // backs are the ERP-blind catches, so the staleness matters and saying so
    // is more useful than quietly serving the last good copy. Real integrations
    // go stale; a demo where every source is current is a demo.
    publisher: "Distributor allocation feed · STALE 14M",
    provenance: "OBSERVED",
    retrievedAt: "2026-07-22T14:18:00Z",
    url: "https://example.stub/distributor/allocations",
    excerpt:
      "Allocation for reinforced-isolation gate-driver parts, including ISO5852SDW, is routed through the authorized Taiwan channel for final test and tape-and-reel prior to distribution release.",
  },
  {
    id: "SRC-IMPORT-REC",
    kind: "IMPORT_RECORD",
    title: "Bill-of-lading & import manifests (assembly/test origin)",
    publisher: "Trade import records aggregator",
    provenance: "OBSERVED",
    retrievedAt: "2026-07-21T00:00:00Z",
    url: "https://example.stub/trade/import-records",
    excerpt:
      "Import manifest, HS 8541.29. Assembly/test facility of record: Kaohsiung, Taiwan. Consignee: authorized distribution channel. Wafer origin (Dallas, TX) does not appear on the manifest; only the last processing site prior to export is captured.",
  },
  {
    id: "SRC-CORP-REGISTRY",
    kind: "CORP_REGISTRY",
    title: "Corporate registry filings: ownership & control disclosures",
    publisher: "National corporate registries (composite)",
    provenance: "OBSERVED",
    retrievedAt: "2026-07-20T00:00:00Z",
    url: "https://example.stub/registry/filings",
    excerpt:
      "Filing of record lists Nanhai Power Semiconductor Holdings as holding a 62% equity stake in Zhongtai Rectifier Trading Co., Ltd, as of the most recent annual return. Filing does not name any entity beyond the immediate parent.",
  },
  {
    id: "SRC-CARRIER-ADV",
    kind: "CARRIER_ADVISORY",
    title: "Carrier schedule-reliability advisories, Taiwan-origin lanes",
    publisher: "Ocean carrier advisories (composite)",
    provenance: "OBSERVED",
    retrievedAt: "2026-07-22T14:31:11Z",
    url: "https://example.stub/carriers/advisories",
    excerpt:
      "Schedule reliability on Taiwan-origin Trans-Pacific strings has fallen to 61%, down from 84% four weeks prior, driven by extended Kaohsiung dwell and knock-on congestion at downstream transshipment hubs.",
  },
  {
    id: "SRC-LEADTIME",
    kind: "MARKET_DATA",
    title: "Component lead-time quotes, aggregated",
    publisher: "Lead-time quote aggregator",
    provenance: "OBSERVED",
    retrievedAt: "2026-07-22T12:00:00Z",
    url: "https://example.stub/market/lead-times",
    excerpt:
      "Aggregated distributor quotes show mean lead time on affected isolation and gate-drive categories extending to 34–38 weeks, up from a 22-week baseline recorded in Q1.",
  },
  {
    id: "SRC-SUBSTRATE-MKT",
    kind: "MARKET_DATA",
    title: "BT substrate & leadframe spot pricing / availability",
    publisher: "Advanced-packaging materials market data",
    provenance: "OBSERVED",
    retrievedAt: "2026-07-22T12:00:00Z",
    url: "https://example.stub/market/substrate",
    excerpt:
      "Spot pricing for BT substrate (0.8mm, high-Tg) is up 14% month-over-month amid tightening leadframe availability tied to mature-node packaging capacity in the affected region.",
  },
  {
    id: "SRC-AFFIL-RULE",
    kind: "REGULATORY",
    title: "Affiliates-screening 50% rule: resumption notice & comment period",
    publisher: "Regulatory docket (fictional)",
    provenance: "OBSERVED",
    retrievedAt: "2026-07-22T14:15:00Z",
    url: "https://example.gov.stub/rules/affiliates-50",
    excerpt:
      "The affiliates-screening obligation under the 50% ownership rule resumes effect for covered transactions on 2026-11-10, following close of a 60-day comment period. Screening applies to any supplier whose ultimate parent holds a controlling stake exceeding the threshold, direct or indirect.",
  },
  {
    id: "SRC-FAB-UTIL",
    kind: "MARKET_DATA",
    title: "Mature-node foundry utilization, weekly tracker",
    publisher: "Foundry utilization tracker",
    provenance: "OBSERVED",
    retrievedAt: "2026-07-22T08:00:00Z",
    url: "https://example.stub/market/fab-utilization",
    excerpt:
      "Mature-node (≥90nm) foundry utilization across tracked fabs is running at 91% of capacity, the highest reading in six quarters. Backend packaging is the tighter of the two constraints.",
  },
  {
    id: "SRC-MONITOR",
    kind: "MARKET_DATA",
    title: "General supply-chain monitor feed",
    publisher: "Gallium monitor",
    provenance: "OBSERVED",
    retrievedAt: "2026-07-22T14:00:00Z",
    url: "https://example.stub/monitor",
    excerpt:
      "No category-specific signal detected for this item at time of retrieval; carried under the standing supply-chain surveillance feed pending a topic-matched source.",
  },
  {
    id: "SRC-LOGI-NET",
    kind: "CARRIER_ADVISORY",
    title: "Logistics network: lane transit & inbound status",
    publisher: "Logistics network telemetry",
    provenance: "OBSERVED",
    retrievedAt: "2026-07-22T14:00:00Z",
    url: "https://example.stub/logistics/network",
    excerpt:
      "Lane transit-time telemetry shows nominal inbound status for this node; no material deviation from scheduled ETA recorded over the trailing 7 days.",
  },
  {
    id: "SRC-NET-INFER",
    kind: "NETWORK_INFERENCE",
    title: "Network inference: deep-tier exposure from industry structure",
    publisher: "Gallium modeling",
    provenance: "MODELED",
    retrievedAt: "2026-07-22T14:32:00Z",
    excerpt:
      "Not a source document. This is Gallium's own inference. Deep-tier exposure is estimated from industry structure: observed packaging-tier concentration, substrate/leadframe market signals, and peer-fab routing patterns, in the absence of a direct per-part record. Converts to OBSERVED as network coverage of this segment grows.",
  },
  {
    id: "SRC-NET-INFER-THIN",
    kind: "NETWORK_INFERENCE",
    title: "INSUFFICIENT COVERAGE: leadframe tier below reporting threshold",
    publisher: "Gallium modeling",
    provenance: "MODELED",
    retrievedAt: "2026-07-22T14:32:00Z",
    excerpt:
      "Not a source document, and not a usable inference either. Leadframe supply into this cluster rests on a single market-structure signal with no corroborating import record or filing, which puts it below the 60% threshold we report against. It is shown because omitting a known-weak link would misrepresent the graph as more complete than it is, not because the number should be acted on. Coverage of this tier is thin industry-wide.",
  },
  {
    id: "SRC-OWNERSHIP-MDL",
    kind: "NETWORK_INFERENCE",
    title: "Ultimate-parent inference: corporate ownership graph",
    publisher: "Gallium modeling",
    provenance: "MODELED",
    retrievedAt: "2026-07-22T14:32:00Z",
    excerpt:
      "Not a source document. This is Gallium's own inference. Ultimate-parent attribution is derived by compounding disclosed equity stakes across the registry chain; no single filing names the ultimate parent directly. Confidence reflects chain depth, filing recency, and stake concentration.",
  },

  // ---- HINDSIGHT screen (Agent, this pass) ------------------
  // Scenario-specific documents for the four lookback events. Each event
  // gets its own count and its own evidence rather than reusing the
  // generic market-data corpus above, so the source count varies row to
  // row on purpose (see HINDSIGHT_HONESTY_OK in lib/data/hindsight.ts).
  // HND-04 gets exactly one thin document because that thinness is the
  // reason the row is a miss, not decoration.
  {
    id: "SRC-HND01-SPOT",
    kind: "MARKET_DATA",
    title: "BT laminate spot price divergence tracker, Guangdong packaging cluster",
    publisher: "Advanced-packaging materials market data",
    provenance: "OBSERVED",
    retrievedAt: "2026-02-10T18:00:00Z",
    url: "https://example.stub/market/substrate-guangdong",
    excerpt:
      "Spot pricing for BT laminate sourced through the Guangdong packaging cluster has diverged from the twelve-month trailing baseline for six consecutive sessions, a pattern that has preceded allocation cuts in the prior two cycles.",
  },
  {
    id: "SRC-HND01-ALLOC",
    kind: "PROCUREMENT",
    title: "Vendor lead-time reforecast, isolation component category",
    publisher: "Meridian Drive Systems (first-party)",
    provenance: "OBSERVED",
    retrievedAt: "2026-03-06T09:00:00Z",
    excerpt:
      "Quarterly reforecast from the vendor master confirms an allocation cut across the isolation component category originating in the Guangdong packaging cluster. Prior quarter's forecast carried no indication of the change.",
  },
  {
    id: "SRC-HND02-PORTAL",
    kind: "DISTRIBUTOR",
    title: "Distributor portal allocation log, reinforced-isolation gate driver family",
    publisher: "Authorized distribution channel",
    provenance: "OBSERVED",
    retrievedAt: "2026-04-17T09:00:00Z",
    url: "https://example.stub/distributor/portal-log",
    excerpt:
      "Allocation log shows reinforced-isolation gate-driver inventory rerouted to priority-tier accounts effective the prior allocation cycle. Standard-tier accounts, including Meridian's, moved to extended lead time.",
  },
  {
    id: "SRC-HND02-REQUOTE",
    kind: "PROCUREMENT",
    title: "Q2 requote cycle memo, isolation gate driver category",
    publisher: "Meridian Drive Systems (first-party)",
    provenance: "OBSERVED",
    retrievedAt: "2026-04-02T14:00:00Z",
    excerpt:
      "Internal procurement memo notes the standard Q2 requote cycle had not yet reflected any allocation change for the gate-driver category at time of writing.",
  },
  {
    id: "SRC-HND03-SAILING",
    kind: "CARRIER_ADVISORY",
    title: "Sailing schedule bulletin, Taiwan-origin test house lanes",
    publisher: "Ocean carrier advisories (composite)",
    provenance: "OBSERVED",
    retrievedAt: "2026-05-22T15:00:00Z",
    url: "https://example.stub/carriers/sailing-schedule",
    excerpt:
      "Bulletin flags reduced schedule reliability on lanes serving the Taiwan-origin backend test house ahead of the next scheduled sailing, with a narrow window to rebook before the slot closes.",
  },
  {
    id: "SRC-HND04-INFER-THIN",
    kind: "NETWORK_INFERENCE",
    title: "Network inference, tier-2 rectifier parent stake crossing, single thread",
    publisher: "Gallium modeling",
    provenance: "MODELED",
    retrievedAt: "2026-06-19T08:00:00Z",
    excerpt:
      "Not a source document, this is Gallium's own inference. The registry filing behind this parent-stake crossing was corroborated by no independent filing or import record at time of assessment, which is why confidence stayed below the escalation threshold. Meridian's own compliance cross-check confirmed the crossing independently five days earlier.",
  },
];

const BY_ID = new Map(SOURCES.map((s) => [s.id, s]));

// Accessor: views resolve a sourceId to its document through this, so a real
// document store can replace the array without touching call sites.
export function getSource(id: string): SourceDoc | undefined {
  return BY_ID.get(id);
}

export function getSources(ids: string[]): SourceDoc[] {
  return ids.map((id) => BY_ID.get(id)).filter((s): s is SourceDoc => !!s);
}

// ---- referential integrity (dev-time guard) ----
// Every sourceId used anywhere in the data layer must resolve to a SourceDoc.
// Throws at import on a dangling reference. This is the contract that lets the
// four downstream agents trust `sourceIds` without re-checking.
export const SOURCE_ASSERTIONS = (() => {
  const referenced = new Set<string>();
  // All seven products, not just the focus one: the other six carry resolved
  // BOMs too (lib/data/products.ts) and their lines cite documents the same way.
  for (const product of PRODUCTS) {
    for (const b of product.lines) {
      b.sourceIds.forEach((id) => referenced.add(id));
      b.ownershipChain?.sourceIds.forEach((id) => referenced.add(id));
    }
  }
  for (const b of BOM) {
    b.sourceIds.forEach((id) => referenced.add(id));
    b.ownershipChain?.sourceIds.forEach((id) => referenced.add(id));
  }
  for (const e of FEED_EVENTS) e.sourceIds.forEach((id) => referenced.add(id));
  PRIMARY_EVENT.sourceIds.forEach((id) => referenced.add(id));
  for (const s of SITES) s.sourceIds.forEach((id) => referenced.add(id));
  for (const n of GRAPH.nodes) n.sourceIds.forEach((id) => referenced.add(id));
  for (const e of GRAPH.edges) e.sourceIds.forEach((id) => referenced.add(id));

  const dangling = [...referenced].filter((id) => !BY_ID.has(id));
  if (dangling.length > 0) {
    throw new Error(`sourceIds reference unknown SourceDoc(s): ${dangling.join(", ")}`);
  }
  return { docs: SOURCES.length, referenced: referenced.size, dangling: 0 };
})();
