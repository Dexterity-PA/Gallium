"use client";

import { useCallback, useRef, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { Scanline } from "@/components/ui/Scanline";
import { parseCsv, extractUploadRows, buildCsvText } from "@/lib/csv";
import { CSV_TEMPLATE_HEADER, CSV_TEMPLATE_ROWS } from "@/lib/data/sampleUpload";
import type { UploadRow } from "@/lib/csv";

interface EntryScreenProps {
  onUseSample: () => void;
  onUpload: (rows: UploadRow[], fileName: string) => void;
}

// The opening shot — no BOM loaded yet, so no dashboard chrome exists around
// this (see AppShell). Composed from the same primitives as every other
// screen (Panel, Scanline, the token palette), just with room to breathe.
export function EntryScreen({ onUseSample, onUpload }: EntryScreenProps) {
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
            setError('No rows found — expected a header row with an "mpn" column.');
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
    <div className="substrate relative flex h-full w-full flex-col items-center justify-center bg-[var(--bg-base)] px-6">
      <Scanline trigger={1} />

      <div className="flex w-full max-w-[560px] flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="text-[10px] tracking-[0.3em] text-[var(--text-lo)]">
            DEMO MODE — SAMPLE DATA
          </div>
          <div className="text-[42px] font-bold tracking-[0.1em] text-[var(--amber)]">
            GALLIUM
          </div>
          <div className="max-w-[420px] text-[12px] leading-relaxed text-[var(--text-mid)]">
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
            className={`flex cursor-pointer flex-col items-center gap-3 border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragOver
                ? "border-[var(--amber)] bg-[var(--bg-elevated)]"
                : "border-[var(--border-hot)]"
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
            <div className="text-[24px] text-[var(--text-lo)]" aria-hidden>
              ⇪
            </div>
            <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--text-hi)]">
              Drop a BOM CSV, or click to browse
            </div>
            <div className="text-[10px] text-[var(--text-lo)]">Columns: mpn, description</div>
          </div>
          {error ? (
            <div className="border-t border-[var(--border)] px-4 py-2 text-[10px] text-[var(--red)]">
              {error}
            </div>
          ) : null}
        </Panel>

        <div className="flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-[var(--border)]" />
          <span className="text-[10px] tracking-[0.1em] text-[var(--text-lo)]">OR</span>
          <div className="h-px flex-1 bg-[var(--border)]" />
        </div>

        <button
          type="button"
          onClick={onUseSample}
          className="flex h-[34px] w-full items-center justify-center gap-2 border border-[var(--amber)] text-[11px] uppercase tracking-[0.12em] text-[var(--amber)] transition-colors hover:bg-[var(--amber)] hover:text-[var(--bg-base)]"
        >
          Use sample BOM — MD-7200
        </button>

        <button
          type="button"
          onClick={downloadTemplate}
          className="text-[10px] tracking-[0.06em] text-[var(--text-lo)] underline decoration-[var(--border-hot)] underline-offset-4 transition-colors hover:text-[var(--text-mid)]"
        >
          Download CSV template
        </button>
      </div>

      <div className="absolute bottom-4 text-[9px] tracking-[0.06em] text-[var(--text-lo)]">
        FICTIONAL SCENARIO — REPRESENTATIVE DATA
      </div>
    </div>
  );
}
