"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDemoState } from "@/lib/hooks/useDemoState";
import { EntryScreen } from "@/components/entry/EntryScreen";
import { ResolutionScreen } from "@/components/entry/ResolutionScreen";
import { resolveUploadRows, type ResolutionSummary } from "@/lib/uploadResolution";
import type { UploadRow } from "@/lib/csv";

// The product's entry state, at /app. "/" above it is the marketing page and
// knows nothing about any of this. Renders with zero dashboard chrome (see
// AppShell's route gating) and owns the entry -> resolution -> dashboard
// state machine: nothing here is a route change until a BOM has actually
// been resolved and the dashboard is entered.
type Stage = { kind: "entry" } | { kind: "resolving"; summary: ResolutionSummary };

// Where the app lands once a BOM is ingested. PORTFOLIO, not RADAR: the story
// starts with the customer's own product line, and the event is what happens
// to one of them. Named once so the post-ingest push and the already-loaded
// replace below cannot drift apart.
const LANDING_ROUTE = "/app/portfolio";

export default function Home() {
  const router = useRouter();
  const { loaded, hydrated, markLoaded } = useDemoState();
  const [stage, setStage] = useState<Stage>({ kind: "entry" });

  // Revisiting "/" (e.g. browser back) once a BOM is already loaded. The
  // dashboard is the real landing state at that point.
  useEffect(() => {
    if (hydrated && loaded) router.replace(LANDING_ROUTE);
  }, [hydrated, loaded, router]);

  // Every entry is an upload now: the sample BOM is a committed CSV the
  // operator drops in, not a button that skips the parser.
  const handleUpload = useCallback((rows: UploadRow[], fileName: string) => {
    const summary = resolveUploadRows(rows, "upload", fileName);
    setStage({ kind: "resolving", summary });
  }, []);

  const handleComplete = useCallback(
    (summary: ResolutionSummary) => {
      markLoaded(summary);
      router.push(LANDING_ROUTE);
    },
    [markLoaded, router]
  );

  if (hydrated && loaded) return null; // redirecting to LANDING_ROUTE

  if (stage.kind === "resolving") {
    return <ResolutionScreen summary={stage.summary} onComplete={handleComplete} />;
  }

  return <EntryScreen onUpload={handleUpload} />;
}
