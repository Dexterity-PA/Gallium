// The marketing copy deck, verbatim from the approved brief. Every Wave 1
// section reads its copy from here; no section writes copy inline. If a line
// needs to change, it changes here and nowhere else.
//
// Meridian Drive Systems is FICTIONAL. Nothing in this deck may imply a real
// customer, and every embedded product view carries the SAMPLE DATA label.

export const SAMPLE_DATA_LABEL = "SAMPLE DATA";

export const POSITIONING =
  "The platform that watches everything that can break the chip supply chain, " +
  "from export rules to shortages to factories going down, and tells companies " +
  "which parts are hit and how to fix them before production stops.";

export const CONTACT_EMAIL = "galliumsupply@gmail.com";
export const GITHUB_URL = "https://github.com/Dexterity-PA/Gallium";

export const NAV = {
  wordmark: "GALLIUM",
  links: [
    { label: "Product", href: "#product" },
    { label: "Pricing", href: "#pricing" },
    { label: "Company", href: "#company" },
  ],
  cta: { label: "VIEW THE PRODUCT", href: "/app" },
} as const;

export const HERO = {
  headline: "Know which parts are about to stop your line.",
  sub: POSITIONING,
  actions: [
    { label: "See the product", href: "/app", primary: true },
    { label: "Talk to us", href: `mailto:${CONTACT_EMAIL}`, primary: false },
  ],
} as const;

export const PROBLEM = {
  ordinal: "01",
  eyebrow: "THE PROBLEM",
  header: "Your ERP is confidently wrong.",
  blocks: [
    {
      claim: "Origin is not where it was made.",
      body:
        "A gate driver can list the United States as country of origin " +
        "because the wafer was fabbed in Dallas, while its assembly and test " +
        "happens in Kaohsiung. When the port closes, the part stops, and " +
        "your system never flagged it.",
    },
    {
      claim: "Ownership changes under you.",
      body:
        "Screening thresholds move, suppliers get acquired, and a part that " +
        "cleared diligence last quarter needs a license this quarter.",
    },
    {
      claim: "By the time you know, the lead time has already run out.",
      body:
        "A part with a 41-week lead has a decision deadline months before " +
        "it has a shortage.",
    },
  ],
} as const;

export const CAPABILITIES = {
  ordinal: "02",
  eyebrow: "WHAT GALLIUM DOES",
  header: "Four things, in one place.",
  rows: [
    {
      label: "MAP",
      claim: "Maps your supply chain past tier one.",
      body:
        "Every part, every site, every route, including the sub-tier inputs " +
        "your BOM does not name.",
    },
    {
      label: "FLAG",
      claim: "Flags exposure the day the world changes.",
      body:
        "Export rules, allocation, closures, weather, ownership, scored " +
        "against your actual parts rather than a country risk index.",
    },
    {
      label: "TRACE",
      claim: "Traces ownership with cited sources.",
      body:
        "Every claim shows the document it came from, and modeled inferences " +
        "are labeled as modeled with a confidence figure.",
    },
    {
      label: "RESOLVE",
      claim: "Delivers the fix, not just the alert.",
      body:
        "Qualified alternates checked for whether they share the same " +
        "exposure, the freight bypass, the buy-ahead, and the paperwork " +
        "generated as a document you can file.",
      // The differentiator: this row may carry slightly more visual weight
      // than the other three.
      emphasis: true,
    },
  ],
} as const;

export const WEDGE = {
  ordinal: "03",
  eyebrow: "THE WEDGE",
  header: "The data exists. The join does not.",
  body:
    "Ownership screening tells you who owns a supplier. Component databases " +
    "tell you who makes a part. Neither tells you that a part you buy today " +
    "has an assembly step inside a zone that closed this morning, or what to " +
    "do about it before your line stops. Gallium is that join, plus the " +
    "resolution.",
} as const;

export const PRODUCT_SEQUENCE = {
  ordinal: "04",
  eyebrow: "PRODUCT",
  header: "One part, three facts nobody had.",
  states: [
    {
      caption: "Your ERP lists this gate driver as United States origin.",
    },
    {
      caption:
        "Assembly and test resolve to Kaohsiung, with the import manifest " +
        "cited.",
    },
    {
      caption:
        "14 of 31 lines exposed. $2.8M of the quarter's build at risk. " +
        "51 days until the line stops.",
    },
  ],
  closing:
    "Then Gallium tells you which actions are sufficient and which are " +
    "over-coverage.",
} as const;

export const PRICING_COPY = {
  ordinal: "05",
  eyebrow: "PRICING",
  header: "Priced per product line.",
  sub: "Pricing scales with BOM size and number of sites.",
  disclaimer: "PLACEHOLDER FIGURES, PENDING APPROVAL.",
} as const;

export const FAQ = {
  eyebrow: "QUESTIONS",
  header: "What buyers ask first.",
  items: [
    {
      q: "How do you know things our ERP does not?",
      a:
        "Your ERP records what you bought and who you bought it from. We map " +
        "what happens upstream of that, including the assembly and test steps " +
        "that decide where a part physically is when something closes.",
    },
    {
      q: "What do you need from us to start?",
      a:
        "A bill of materials. One CSV. We match it, tell you what we could " +
        "not resolve, and show you the exposure. We do not need ERP access " +
        "to begin.",
    },
    {
      q: "What happens when you are not sure?",
      a:
        "We label it. Observed facts cite a document. Modeled inferences are " +
        "marked as modeled and carry a confidence figure, and they convert " +
        "to observed as coverage grows.",
    },
    {
      q: "Do you replace our compliance process?",
      a:
        "No. We generate the diligence package and supporting documents that " +
        "your process attaches. Export license applications are filed " +
        "electronically through the government's own system, and we do not " +
        "pretend otherwise.",
    },
    {
      q: "Is this just alerts?",
      a:
        "No. An alert is the cheap part. We tell you which qualified " +
        "alternates actually escape the exposure, which of them share the " +
        "same backend site, and which actions are sufficient against a given " +
        "disruption duration.",
    },
    {
      q: "Can we try it on our own BOM?",
      a: "Yes. Talk to us.",
    },
  ],
} as const;

export const CLOSING = {
  header: "Find out what your BOM is actually exposed to.",
  actions: [
    { label: "See the product", href: "/app", primary: true },
    { label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}`, primary: false },
  ],
} as const;

export const FOOTER = {
  wordmark: "GALLIUM",
  positioning: POSITIONING,
  email: CONTACT_EMAIL,
  github: GITHUB_URL,
  githubLabel: "github.com/Dexterity-PA/Gallium",
  note:
    "The product demo runs on a fictional company and fictional sample data.",
  copyright: "© 2026 Gallium",
} as const;
