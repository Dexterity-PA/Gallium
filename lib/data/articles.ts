import type { Article } from "@/lib/types";
import { SOURCES } from "@/lib/data/sources";
import { BOM } from "@/lib/data/bom";

// Fictional news articles: the ingest corpus (see lib/news/ingest.ts's
// LocalArticleSource, which reads this array). Every article is
// `fictional: true`, its `sourceIds` resolve in lib/data/sources.ts, and any
// `relatedBomIds` resolve in lib/data/bom.ts. `relatedBomIds` is left unset on
// most entries on purpose. It is the pre-existing curator's note, not a
// contract; lib/news/classify.ts + match.ts compute matchedBomIds
// independently and lib/news/pipeline.ts reconciles the two (see
// ARTICLE_MATCH_RECONCILIATIONS), which is more honest than hand-filling a
// field nothing checks.
export const ARTICLES: Article[] = [
  {
    id: "ART-KHH-QUARANTINE",
    headline: "Kaohsiung container traffic halts under new inspection regime",
    outlet: "Strait Logistics Wire",
    publishedAt: "2026-07-22T15:10:00Z",
    dek: "Ocean freight holds at berth as a customs inspection regime lands; air corridors remain open.",
    body: `Outbound container traffic at the Port of Kaohsiung came to a standstill Wednesday afternoon after customs authorities announced a new inspection regime covering all ocean freight departing the port and adjacent anchorages, according to bulletins reviewed by this outlet and confirmed independently by two carrier advisories.

The regime applies to outbound container traffic only. Air corridors serving Kaohsiung and the broader Taiwan Strait region are explicitly unaffected, and inbound cargo is moving on a normal schedule. Vessels already loaded and awaiting departure clearance are being held at berth pending inspection, with port operators declining to estimate a timeline for clearance.

"We are seeing holds, not seizures," one logistics manager at a mid-size freight forwarder said, speaking on condition their firm not be named while the situation develops. "Nothing has been turned back. It's the waiting that's the problem."

Two ocean carriers issued schedule-reliability advisories for Taiwan-origin lanes within hours of the customs bulletin, warning shippers to expect multi-day delays on any booking routed through Kaohsiung. Berth wait times at the port had already been extending in the prior 48 hours, though the cause was not publicly attributed until Wednesday's announcement.

Industry contacts caution that the regime's scope and duration remain unclear, and that supply chains with backend assembly and test operations sited in the inspection zone face the most immediate exposure, a category that includes power semiconductor packaging widely used in industrial motor-drive electronics.

This article is fictional and produced for demonstration purposes.`,
    sourceIds: ["SRC-KHH-CUSTOMS", "SRC-PORT-KHH", "SRC-CARRIER-ADV"],
    fictional: true,
  },
  {
    id: "ART-AFFILIATES-RULE",
    headline: "Affiliates-screening threshold set to resume in November",
    outlet: "Trade Compliance Daily",
    publishedAt: "2026-07-22T16:00:00Z",
    dek: "The 50% ownership screening rule, suspended under the 2025 truce, returns Nov 10, and diligence and license obligations attach to affected suppliers.",
    body: `The 50% affiliates-ownership screening threshold will resume enforcement on November 10, 2026, regulatory dockets reviewed by this outlet confirm, ending a suspension that had been in place since a bilateral trade truce reached in November 2025.

Under the rule, any supplier in which a restricted entity holds a controlling or majority stake, defined as crossing the 50% ownership threshold whether directly or through an intermediate parent, becomes subject to enhanced diligence and, in some cases, export-license requirements before affected components can ship. The rule had applied broadly before the truce suspended it; its return restores the pre-truce screening posture without modification, according to the docket language.

Corporate registry filings reviewed alongside the rule change show that ownership structures for a number of suppliers have shifted in the interim, meaning the set of affected relationships when screening resumes may not exactly match the set flagged before the suspension. Companies that rely on multi-tier supplier networks are being advised to re-run diligence rather than assume prior clearances still hold.

The filing window ahead of the November 10 effective date is expected to be compressed. Trade compliance counsel interviewed for this piece characterized the runway as "tight but workable" for firms that start diligence now rather than waiting for the formal comment period to close.

Notably, affiliates-screening exposure is independent of any logistics disruption. A supplier can be entirely unaffected by port or customs activity and still cross the ownership threshold, or vice versa.

This article is fictional and produced for demonstration purposes.`,
    sourceIds: ["SRC-AFFIL-RULE", "SRC-CORP-REGISTRY"],
    relatedBomIds: ["BOM-27", "BOM-31"],
    fictional: true,
  },
  {
    id: "ART-SUBSTRATE-SQUEEZE",
    headline: "BT substrate pricing climbs as packaging tightens",
    outlet: "Advanced Packaging Report",
    publishedAt: "2026-07-22T12:30:00Z",
    dek: "Spot substrate pricing rises month-over-month, pressuring deep-tier module supply that few BOMs track.",
    body: `Spot pricing for BT (bismaleimide-triazine) laminate substrate rose 2.1% month-over-month, according to market data reviewed by this outlet, as packaging capacity across the region continues to tighten.

Substrate and leadframe materials sit several tiers below the components most bills of materials explicitly track, which means the pricing pressure is largely invisible to standard procurement dashboards until it surfaces as a lead-time extension or cost increase on a finished module. Power semiconductor modules, IGBT packages in particular, are disproportionately exposed, since they consume both BT substrate and specialty leadframe stock in the same assembly step.

Sourcing analysts describe the current move as consistent with broader packaging-capacity tightness rather than a single acute event, though they note that any additional disruption to backend assembly and test capacity in the region would compound the existing pressure rather than substitute for it.

Because deep-tier material supply is rarely disclosed by tier-1 suppliers, exposure at this level is typically inferred from industry structure and market signals rather than confirmed directly, a distinction procurement teams are advised to keep visible rather than treat modeled exposure as equivalent to a confirmed shortage.

This article is fictional and produced for demonstration purposes.`,
    sourceIds: ["SRC-SUBSTRATE-MKT"],
    relatedBomIds: ["BOM-12", "BOM-13", "BOM-14"],
    fictional: true,
  },
  {
    id: "ART-PORT-CONGESTION",
    headline: "Berth wait times stretch at Kaohsiung as cause remains unattributed",
    outlet: "Strait Logistics Wire",
    publishedAt: "2026-07-22T14:40:00Z",
    dek: "Vessel holding times at the Port of Kaohsiung extended through the afternoon; port operators had not publicly attributed a cause as of this filing.",
    body: `Berth wait times at the Port of Kaohsiung extended noticeably through Wednesday afternoon, according to port status feeds monitored by this outlet, with no public attribution of a cause available at the time of this filing.

Vessels already at anchor reported longer-than-scheduled holds before berth assignment, and several outbound sailings were pushed from their original windows. Port operators have not issued a formal statement, and shippers contacted by this outlet described the congestion as "unusual but not yet alarming" as of early afternoon.

This is a developing story; a customs inspection regime affecting outbound container traffic was announced roughly thirty minutes after this article's initial filing, which may explain the berth delays reported here. See our follow-up coverage for the confirmed cause.

This article is fictional and produced for demonstration purposes.`,
    sourceIds: ["SRC-PORT-KHH"],
    fictional: true,
  },
  {
    id: "ART-CARRIER-ADVISORY",
    headline: "Two carriers flag schedule reliability on Taiwan-origin lanes",
    outlet: "Ocean Freight Monitor",
    publishedAt: "2026-07-22T14:45:00Z",
    dek: "Carrier advisories warn shippers to expect delays on Taiwan-origin bookings following port-side disruption at Kaohsiung.",
    body: `Two major ocean carriers issued schedule-reliability advisories Wednesday for lanes originating in Taiwan, warning shippers booked through the Port of Kaohsiung to expect delays of several days against published transit times.

The advisories, reviewed by this outlet, cite "port-side operational disruption" without further detail, consistent with berth congestion and a customs inspection regime reported separately the same afternoon. Both carriers said existing bookings would be honored but urged shippers with time-sensitive cargo to evaluate alternate routing, including transshipment through Taipei-area distribution hubs where feasible.

Freight forwarders contacted by this outlet described booking inquiries for air alternatives rising sharply within hours of the advisories, though capacity on affected lanes remains limited on short notice.

This article is fictional and produced for demonstration purposes.`,
    sourceIds: ["SRC-CARRIER-ADV"],
    fictional: true,
  },
  {
    id: "ART-ALLOCATION-DISCRETES",
    headline: "Distributor allocation tightens on 600V power discretes",
    outlet: "Semiconductor Channel Report",
    publishedAt: "2026-07-22T14:05:00Z",
    dek: "Two authorized distribution channels report tightening allocation on 600V-class IGBT modules and related power discretes.",
    body: `Allocation on 600V-class IGBT modules is tightening across at least two authorized distribution channels, according to channel notices reviewed by this outlet, as buyers pull forward orders against uncertain lead times.

Distributors describe the tightening as allocation-driven rather than an outright shortage: authorized channels are prioritizing existing contracted volumes over spot demand, which pushes non-contracted buyers toward longer queues and, in some cases, gray-market alternatives that carry their own quality and traceability risk.

The affected category overlaps heavily with power-stage components used in industrial motor-drive electronics, where a single IGBT module or discrete rectifier can be a single-source design-in with no qualified second source on short notice.

This article is fictional and produced for demonstration purposes.`,
    sourceIds: ["SRC-DIST-ALLOC"],
    fictional: true,
  },
  {
    id: "ART-LEADTIME-OPTOCOUPLERS",
    headline: "Isolation component lead times stretch as optocoupler demand climbs",
    outlet: "Passive & Discrete Times",
    publishedAt: "2026-07-22T14:12:00Z",
    dek: "Quoted lead times are extending 3-5 weeks across the isolation component category, aggregated market data shows.",
    body: `Quoted lead times for optocouplers and related gate-isolation components are extending by three to five weeks industry-wide, according to aggregated market data reviewed by this outlet, continuing a trend that has been building for several quarters.

Isolation components (optocouplers, isolated gate drivers, and the reinforced-isolation resistor networks that accompany them) sit in a narrow product category with relatively few qualified suppliers per design, which makes the category more sensitive to demand swings than higher-volume passives.

Buyers in industrial motor-drive and power-conversion segments, where isolation parts are safety-critical and rarely substitutable without a full requalification cycle, are advised to treat the extension as a planning input now rather than a surprise at next quarter's quote.

This article is fictional and produced for demonstration purposes.`,
    sourceIds: ["SRC-LEADTIME"],
    fictional: true,
  },
  {
    id: "ART-EXPORT-COMMENT",
    headline: "Ownership-screening rule change enters public comment period",
    outlet: "Trade Compliance Daily",
    publishedAt: "2026-07-22T14:20:00Z",
    dek: "A proposed rule affecting affiliates-ownership screening thresholds has entered public comment ahead of the November resumption.",
    body: `A proposed rule affecting affiliates-ownership screening thresholds entered its public comment period Wednesday, regulatory filings show, running in parallel with the confirmed November 10 resumption of the underlying 50% threshold screening rule reported elsewhere this week.

The comment period covers implementation mechanics (filing formats, diligence documentation standards, and appeal procedures for suppliers that dispute a threshold determination) rather than the threshold itself, which is already fixed by the resumption notice. Compliance counsel note that public comment on mechanics rarely changes an effective date, so firms should not treat the open comment period as a reason to delay diligence.

This article is fictional and produced for demonstration purposes.`,
    sourceIds: ["SRC-AFFIL-RULE"],
    fictional: true,
  },
  {
    id: "ART-TYPHOON-LUZON",
    headline: "Tropical system tracks north through Luzon Strait, shipping advisories issued",
    outlet: "Pacific Maritime Weather Desk",
    publishedAt: "2026-07-22T14:25:00Z",
    dek: "A tropical system tracking north through the Luzon Strait has prompted shipping advisories; no port closures have been ordered.",
    body: `A tropical system tracking north through the Luzon Strait prompted shipping advisories from regional maritime authorities Wednesday, though no port closures have been ordered as of this filing.

Forecast models reviewed by this outlet show the system's current track passing east of Taiwan's main shipping lanes, with the greatest uncertainty in the 72-hour forecast window. Carriers operating in the region are pre-positioning schedule buffers as a precaution; this is standard practice at this stage of a system's development and does not by itself indicate a closure is likely.

Shippers with cargo already delayed by port-side disruption at Kaohsiung this week are watching the storm track closely, since a closure layered on top of existing congestion would compound rather than replace the current delay.

This article is fictional and produced for demonstration purposes.`,
    sourceIds: ["SRC-CARRIER-ADV"],
    fictional: true,
  },
  {
    id: "ART-FAB-UTILIZATION",
    headline: "Mature-node foundry utilization edges up across tracked fabs",
    outlet: "Foundry Capacity Tracker",
    publishedAt: "2026-07-22T08:15:00Z",
    dek: "Weekly tracker data shows mature-node utilization up 0.4 point week-over-week across tracked foundries.",
    body: `Mature-node foundry utilization rose 0.4 percentage point week-over-week across tracked foundries, according to weekly tracker data reviewed by this outlet, continuing a gradual climb that began earlier this quarter.

The move is broad-based rather than concentrated in a single process node or geography, and analysts describe it as consistent with steady end-demand recovery rather than a supply-side event. No allocation or lead-time impact has been reported in connection with this data point.

This article is fictional and produced for demonstration purposes.`,
    sourceIds: ["SRC-FAB-UTIL"],
    fictional: true,
  },
  {
    id: "ART-DEEPTIER-INFERENCE",
    headline: "Deep-tier substrate exposure inferred from industry structure, not yet confirmed",
    outlet: "Supply Chain Signals",
    publishedAt: "2026-07-22T14:33:00Z",
    dek: "Network analysis suggests packaging-material supply for the region may route through the same constrained cluster, an inference rather than a confirmed filing.",
    body: `Network analysis of regional packaging-material supply structure suggests that BT substrate and leadframe capacity serving Taiwan-area backend assembly may route through a narrower cluster of sub-tier suppliers than public filings alone would indicate, according to modeling reviewed by this outlet.

This finding is explicitly an inference, not a confirmed filing: no supplier disclosure or customs record directly ties any specific module supply chain to the modeled cluster. It is derived from industry structure (patterns of ownership, geography, and known capacity) rather than a primary document, and should be weighted accordingly relative to directly observed sources.

If the inference holds, any disruption affecting backend assembly capacity in the region would plausibly extend into deep-tier packaging-material availability with a lag, rather than being contained to the assembly step alone. Procurement teams are advised to track this as a modeled watch item, not to act on it as though it were confirmed.

This article is fictional and produced for demonstration purposes.`,
    sourceIds: ["SRC-SUBSTRATE-MKT", "SRC-NET-INFER"],
    fictional: true,
  },

  // ---- second pieces on stories the corpus already covers ----------------
  // A story that matters gets covered more than once, by more than one desk,
  // and the follow-ups are shorter and narrower than the original. Wiring
  // these to feed rows lives in lib/news/match.ts (EVENT_ARTICLES), which is
  // outside this module; see the handoff note in that file's neighbourhood.
  {
    id: "ART-KHH-AIRFREIGHT",
    headline: "Air corridors absorb rerouted Kaohsiung cargo at a premium",
    outlet: "Air Cargo Brief",
    publishedAt: "2026-07-22T17:45:00Z",
    dek: "Spot rates on Taipei-origin lanes move sharply as shippers pull cargo off held vessels.",
    body: `Spot air-freight rates on Taipei-origin trans-Pacific lanes moved sharply higher within hours of Wednesday's customs announcement at Kaohsiung, as shippers with time-critical cargo began pulling bookings off vessels held at berth.

Forwarders contacted for this piece described the shift as orderly but expensive. Capacity out of the region was already tight ahead of the announcement, and the incremental demand is landing on a freighter network with little slack. One forwarder characterized current pricing as "whatever clears the market this afternoon."

The reroute is only available to cargo that is already through assembly and test and physically outside the inspection scope. Shipments still inside the zone cannot be air-freighted out of a hold, a distinction some shippers have been slow to draw.

This article is fictional and produced for demonstration purposes.`,
    sourceIds: ["SRC-CARRIER-ADV", "SRC-PORT-KHH"],
    fictional: true,
  },
  {
    id: "ART-KHH-BERTH-DWELL",
    headline: "Berth dwell at Kaohsiung terminals doubles in 48 hours",
    outlet: "Port Metrics Weekly",
    publishedAt: "2026-07-22T14:50:00Z",
    dek: "Terminal status data shows average dwell up 6.2 days week-over-week, with utilization at 41% of nominal.",
    body: `Average vessel dwell at Kaohsiung terminals 68 and 69 has risen 6.2 days week-over-week, with berth utilization falling to 41% of nominal, according to terminal status data reviewed by this outlet.

The deterioration began before Wednesday's customs announcement, which is consistent with inspection activity ramping ahead of the formal bulletin rather than starting with it. Port operators have not commented on the sequencing.

This article is fictional and produced for demonstration purposes.`,
    sourceIds: ["SRC-PORT-KHH"],
    fictional: true,
  },
  {
    id: "ART-OPTO-SECOND-SOURCE",
    headline: "Buyers turn to second-source optocouplers as quotes stretch",
    outlet: "Component Sourcing Monitor",
    publishedAt: "2026-07-22T11:20:00Z",
    dek: "Requalification timelines, not availability, are the binding constraint on switching isolation parts.",
    body: `Buyers facing extended quotes on isolation components are increasingly evaluating second-source optocouplers, though requalification rather than availability is the binding constraint, sourcing managers interviewed for this piece said.

Isolation parts sit inside safety-rated signal paths in motor-drive and power-conversion designs, which means a substitution generally triggers a formal requalification against the applicable standard rather than a paperwork change. Several buyers described three-week requalification windows as the realistic floor where existing test capacity is available, and considerably longer where it is not.

This article is fictional and produced for demonstration purposes.`,
    sourceIds: ["SRC-LEADTIME", "SRC-DIST-ALLOC"],
    relatedBomIds: ["BOM-04"],
    fictional: true,
  },
];

const BY_ID = new Map(ARTICLES.map((a) => [a.id, a]));

export function getArticle(id: string): Article | undefined {
  return BY_ID.get(id);
}

// Referential integrity (dev-time guard): every Article.sourceIds and
// relatedBomIds must resolve. Mirrors the guard pattern in
// lib/data/sources.ts / lib/data/bom.ts so a typo'd id fails at import
// instead of silently rendering nothing.
export const ARTICLE_REFERENTIAL_INTEGRITY_OK = (() => {
  const sourceIds = new Set(SOURCES.map((s) => s.id));
  const bomIds = new Set(BOM.map((b) => b.id));
  for (const a of ARTICLES) {
    const danglingSrc = a.sourceIds.filter((id) => !sourceIds.has(id));
    if (danglingSrc.length > 0) {
      throw new Error(`Article ${a.id} references unknown SourceDoc(s): ${danglingSrc.join(", ")}`);
    }
    const danglingBom = (a.relatedBomIds ?? []).filter((id) => !bomIds.has(id));
    if (danglingBom.length > 0) {
      throw new Error(`Article ${a.id} references unknown BomLine(s): ${danglingBom.join(", ")}`);
    }
  }
  return true;
})();
