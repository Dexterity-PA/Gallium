"use client";

import { useCallback, useRef, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { Scanline } from "@/components/ui/Scanline";
import { parseCsv, extractUploadRows, buildCsvText } from "@/lib/csv";
import { CSV_TEMPLATE_HEADER, CSV_TEMPLATE_ROWS } from "@/lib/data/sampleUpload";
import type { UploadRow } from "@/lib/csv";

interface EntryScreenProps {
  onUpload: (rows: UploadRow[], fileName: string) => void;
}

// The opening shot. No BOM loaded yet, so no dashboard chrome exists around
// this (see AppShell). Composed from the same primitives as every other
// screen (Panel, Scanline, the token palette), just with room to breathe.
//
// There is no "use sample BOM" button. A one-click path into a pre-loaded
// dataset is the thing that makes a demo look like a demo: it says the
// numbers downstream were waiting for you rather than computed from what you
// handed over. Upload and drag-drop are the only way in, and the sample is a
// real committed file (public/sample/MD-7200-BOM.csv, written by
// scripts/build-sample-csv.mjs) that goes through the same parser.
export function EntryScreen({ onUpload }: EntryScreenProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      file
        .text()
        .then((text) => {
          const rows = extractUploadRows(parseCsv(text));
          if (rows.length === 0) {
            setError('No rows found: expected a header row with an "mpn" column.');
            return;
          }
          onUpload(rows, file.name);
        })
        .catch(() => setError("Could not read that file."));
    },
    [onUpload]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile]
  );

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  const downloadTemplate = useCallback(() => {
    const csv = buildCsvText(CSV_TEMPLATE_HEADER, CSV_TEMPLATE_ROWS);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gallium-bom-template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="substrate relative flex h-full w-full flex-col items-center justify-center bg-[var(--bg-base)] px-4">
      <Scanline trigger={1} />

      <div className="flex w-full max-w-[560px] flex-col items-center gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="text-[10px] tracking-[0.3em] text-[var(--text-dim)]">
            DEMO MODE · SAMPLE DATA
          </div>
          <div className="text-[42px] font-bold tracking-[0.1em] text-[var(--text-primary)]">
            GALLIUM
          </div>
          <div className="max-w-[420px] text-[12px] leading-relaxed text-[var(--text-secondary)]">
            Chip supply chain shocks, caught before your ERP notices them.
          </div>
        </div>

        <Panel label="Load a BOM" className="w-full" noPad>
          <div
            role="button"
            tabIndex={0}
            onClick={openPicker}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openPicker();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`flex cursor-pointer flex-col items-center gap-3 border border-dashed px-4 py-4 text-center transition-colors ${
              dragOver
                ? "border-[var(--focus)] bg-[var(--bg-elevated)]"
                : "border-[var(--rule-strong)]"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onPick}
              aria-label="Upload BOM CSV"
            />
            <div className="text-[24px] text-[var(--text-dim)]" aria-hidden>
              ⇪
            </div>
            <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--text-primary)]">
              Drop a BOM CSV, or click to browse
            </div>
            <div className="text-[10px] text-[var(--text-dim)]">Columns: mpn, description</div>
          </div>
          {error ? (
            <div className="border-t border-[var(--rule)] px-4 py-2 text-[10px] text-[var(--critical)]">
              {error}
            </div>
          ) : null}
        </Panel>

        <button
          type="button"
          onClick={downloadTemplate}
          className="text-[10px] tracking-[0.06em] text-[var(--text-dim)] underline decoration-[var(--rule-strong)] underline-offset-4 transition-colors hover:text-[var(--text-secondary)]"
        >
          Download CSV template
        </button>
      </div>

      <div className="absolute bottom-4 text-[9px] tracking-[0.06em] text-[var(--text-dim)]">
        FICTIONAL SCENARIO · REPRESENTATIVE DATA
      </div>
    </div>
  );
}
