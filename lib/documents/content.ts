import type { Action } from "@/lib/types";
import { CUSTOMER } from "@/lib/data/customer";

// ------------------------------------------------------------------
// Shared document content: titles, intros, and the reference/terms/
// signatory metadata for the four RESOLVE documents. This is the ONE
// place that copy lives; components/resolve/DocumentModal.tsx (the
// on-screen preview) and lib/documents/pdf.ts (the downloadable PDF)
// both import from here, so the two renderings never drift.
//
// LICENSE note: the document is a supporting diligence package, not a
// license application. BIS export license applications are filed
// electronically through SNAP-R; the paper BIS-748P is exception-only
// and a filled-in reproduction of it would depict an invalid filing
// route. Title, intro, and terms below say explicitly that software
// prepares the case; a human files it elsewhere.
// ------------------------------------------------------------------

export const DOC_TITLE: Record<Action["kind"], string> = {
  EXPEDITE: "AIR FREIGHT AUTHORIZATION",
  SUBSTITUTE: "COMPONENT QUALIFICATION PACKET",
  BUY_AHEAD: "PURCHASE REQUISITION",
  LICENSE: "EXPORT COMPLIANCE DILIGENCE PACKAGE",
};

export const DOC_INTRO: Record<Action["kind"], string> = {
  EXPEDITE:
    "Authorize expedited air movement of finished-goods inventory from Kaohsiung backend to Rockford assembly, bypassing quarantined ocean freight.",
  SUBSTITUTE:
    "Initiate qualification of a form-fit-function alternate with backend assembly outside the quarantine zone.",
  BUY_AHEAD:
    "Requisition forward inventory coverage on affected categories ahead of forecast lead-time extension.",
  LICENSE:
    "Compile the Red Flag 29 affiliates-screening diligence and export-license determination for the two suppliers crossing the 50% ownership threshold, ahead of the screening obligation that attaches 2026-11-10. This package supports a license determination; it is not a license application and is not filed with any agency.",
};

export type Term = { k: string; v: string };

export type DocMeta = {
  refPrefix: string;
  issuingDept: string;
  lineHeading: string;
  terms: Term[];
  signatories: string[];
  reviewLine: string;
};

export const DOC_META: Record<Action["kind"], DocMeta> = {
  EXPEDITE: {
    refPrefix: "MDS-AFA",
    issuingDept: "LOGISTICS / TRAFFIC",
    lineHeading: "AIR MANIFEST · COVERED LINES",
    terms: [
      { k: "INCOTERMS", v: "CIP · ROCKFORD, IL" },
      { k: "MODE / ROUTING", v: "AIR · KHH → ORD" },
      { k: "ORIGIN", v: "KAOHSIUNG BACKEND (A&T)" },
      { k: "DESTINATION", v: "ROCKFORD ASSEMBLY" },
      { k: "CARGO", v: "FINISHED GOODS" },
      { k: "INSURANCE", v: "ALL-RISK · SHIPMENT VALUE" },
    ],
    signatories: ["PROCUREMENT LEAD", "LOGISTICS / TRAFFIC", "FINANCE"],
    reviewLine: "LOGISTICS + FINANCE SIGN-OFF REQUIRED",
  },
  SUBSTITUTE: {
    refPrefix: "MDS-QP",
    issuingDept: "ENGINEERING / QUALITY",
    lineHeading: "QUALIFICATION SCOPE · COVERED LINES",
    terms: [
      { k: "QUAL STANDARD", v: "IEC 61800-5-1" },
      { k: "QUAL TYPE", v: "FORM-FIT-FUNCTION ALT" },
      { k: "TEST SCOPE", v: "ISOLATION · THERMAL · EMC" },
      { k: "SAMPLE PLAN", v: "3-LOT · FIRST ARTICLE" },
      { k: "DISPOSITION", v: "PENDING FIRST-ARTICLE" },
    ],
    signatories: ["ENGINEERING (QUAL)", "QUALITY", "PROCUREMENT"],
    reviewLine: "ENGINEERING + QUALITY SIGN-OFF REQUIRED",
  },
  BUY_AHEAD: {
    refPrefix: "MDS-PR",
    issuingDept: "PROCUREMENT",
    lineHeading: "REQUISITION LINES",
    terms: [
      { k: "PAYMENT TERMS", v: "NET 45" },
      { k: "DELIVERY", v: "STAGGERED WEEKLY RELEASES" },
      { k: "BUDGET", v: "Q4 2026 CAPITAL" },
      { k: "APPROVAL TIER", v: "> $250K · VP OPS" },
      { k: "BASIS", v: "FORECAST LEAD-TIME EXTENSION" },
    ],
    signatories: ["PROCUREMENT LEAD", "FINANCE / TREASURY", "OPERATIONS"],
    reviewLine: "PROCUREMENT + TREASURY SIGN-OFF REQUIRED",
  },
  LICENSE: {
    refPrefix: "MDS-XL",
    issuingDept: "TRADE COMPLIANCE / LEGAL",
    lineHeading: "AFFILIATES SCREENING · FLAGGED SUPPLIERS",
    terms: [
      { k: "DILIGENCE BASIS", v: "RED FLAG 29 · AFFILIATES" },
      { k: "SCREENING THRESHOLD", v: "50% AFFILIATES" },
      { k: "OBLIGATION ATTACHES", v: "2026-11-10" },
      { k: "FILING WINDOW", v: "BY 2026-10-15" },
      { k: "DETERMINATION", v: "PENDING · PROC + LEGAL" },
      { k: "FILING ROUTE", v: "SNAP-R · ELECTRONIC · NOT FILED BY THIS DOCUMENT" },
    ],
    signatories: ["TRADE COMPLIANCE", "LEGAL COUNSEL", "PROCUREMENT"],
    reviewLine: "TRADE COMPLIANCE + LEGAL SIGN-OFF REQUIRED",
  },
};

export const ISSUE_DATE = "2026-07-22";
export const ISSUER = CUSTOMER.name.toUpperCase();

/**
 * Filename an emitting system would use: ref prefix, issue date (no
 * separators), action kind, no spaces. e.g. MDS-AFA-20260722-EXPEDITE.pdf
 */
export function filenameFor(action: Action): string {
  const meta = DOC_META[action.kind];
  const compactDate = ISSUE_DATE.replace(/-/g, "");
  const kind = action.id.replace(/^ACT-/, "");
  return `${meta.refPrefix}-${compactDate}-${kind}.pdf`;
}
