"use client";

import type { Action } from "@/lib/types";
import { generateDocumentPdf } from "@/lib/documents/pdf";
import { filenameFor } from "@/lib/documents/content";

/**
 * Generate the action's PDF and trigger a browser download. Runs
 * entirely client-side (pdf-lib in the browser bundle), same pattern
 * as the existing CSV-template download in components/entry/EntryScreen.tsx.
 */
export async function downloadDocumentPdf(action: Action): Promise<void> {
  const bytes = await generateDocumentPdf(action);
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filenameFor(action);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
