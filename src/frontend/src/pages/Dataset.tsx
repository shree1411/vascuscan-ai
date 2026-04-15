/**
 * Dataset.tsx — Dataset Management page for VASCUSCAN AI.
 * Upload CSV datasets, preview rows, and manage stored datasets.
 */
import { useCallback, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import type { DatasetColumn, Dataset as DatasetType } from "../types";

const REQUIRED_COLUMNS: (keyof DatasetColumn)[] = [
  "age",
  "gender",
  "diabetes_status",
  "hypertension_status",
  "cholesterol_level",
  "ldl",
  "hdl",
  "smoking_status",
  "ecg_hrv",
  "ecg_qrs_duration",
  "ppg_peak_amplitude",
  "perfusion_index",
  "ptt",
  "risk_label",
];

function parseCSV(text: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const lines = text.trim().split("\n");
  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = vals[i] ?? "";
    });
    return row;
  });
  return { headers, rows };
}

function toDatasetColumn(row: Record<string, string>): DatasetColumn {
  return {
    age: Number(row.age),
    gender: row.gender,
    diabetes_status: Number(row.diabetes_status),
    hypertension_status: Number(row.hypertension_status),
    cholesterol_level: Number(row.cholesterol_level),
    ldl: Number(row.ldl),
    hdl: Number(row.hdl),
    smoking_status: Number(row.smoking_status),
    ecg_hrv: Number(row.ecg_hrv),
    ecg_qrs_duration: Number(row.ecg_qrs_duration),
    ppg_peak_amplitude: Number(row.ppg_peak_amplitude),
    perfusion_index: Number(row.perfusion_index),
    ptt: Number(row.ptt),
    risk_label: row.risk_label,
  };
}

const BG = "#0a0f1a";
const PANEL = "#0d1525";
const BORDER = "#1e2d45";
const ACCENT = "#00d4ff";
const TEXT = "#e8eaf0";
const MUTED = "#64748b";
const DANGER = "#ef4444";
const SUCCESS = "#22c55e";

function StatBadge({
  label,
  value,
  color,
}: { label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <p className="text-xs font-bold" style={{ color }}>
        {value}
      </p>
      <p className="text-xs" style={{ color: "#475569", fontSize: "10px" }}>
        {label}
      </p>
    </div>
  );
}

export default function DatasetPage() {
  const datasets = useStore((s) => s.datasets);
  const addDataset = useStore((s) => s.addDataset);
  const removeDataset = useStore((s) => s.removeDataset);

  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [errorLines, setErrorLines] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".csv")) {
        setErrorLines(["Only .csv files are accepted."]);
        return;
      }
      setErrorLines([]);
      setSuccessMsg("");
      setParsing(true);
      await new Promise((r) => setTimeout(r, 300));
      const text = await file.text();
      const { headers, rows } = parseCSV(text);
      const missing = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
      if (missing.length > 0) {
        setErrorLines([
          "Missing required columns:",
          ...missing.map((c) => `  - ${c}`),
        ]);
        setParsing(false);
        return;
      }
      const dataset: DatasetType = {
        id: `ds-${Date.now()}`,
        name: file.name.replace(".csv", ""),
        uploadedAt: new Date().toISOString(),
        rowCount: rows.length,
        columns: headers,
        rows: rows.map(toDatasetColumn),
      };
      addDataset(dataset);
      setSuccessMsg(
        `Dataset "${dataset.name}" uploaded — ${rows.length} rows loaded.`,
      );
      setParsing(false);
    },
    [addDataset],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void processFile(file);
    },
    [processFile],
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
    e.target.value = "";
  };

  const selectedDataset = datasets.find((d) => d.id === selectedId);

  const riskDist = selectedDataset
    ? (() => {
        const total = selectedDataset.rows.length;
        const low = selectedDataset.rows.filter((r) =>
          r.risk_label?.toLowerCase().includes("low"),
        ).length;
        return {
          low: total > 0 ? ((low / total) * 100).toFixed(1) : "0",
          high: total > 0 ? (((total - low) / total) * 100).toFixed(1) : "0",
        };
      })()
    : null;

  return (
    <div
      className="min-h-screen p-6 space-y-6"
      style={{ background: BG, color: TEXT }}
      data-ocid="dataset.page"
    >
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: "rgba(0,212,255,0.15)",
            border: "1px solid rgba(0,212,255,0.3)",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={ACCENT}
            strokeWidth="2"
            aria-hidden="true"
          >
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
            <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: ACCENT }}>
            Dataset Management
          </h1>
          <p className="text-xs" style={{ color: MUTED }}>
            Upload and manage CSV datasets for AI model training and testing
          </p>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        className="rounded-xl"
        style={{ background: PANEL, border: `1px solid ${BORDER}` }}
      >
        <div className="p-4 border-b" style={{ borderColor: BORDER }}>
          <h2 className="text-sm font-semibold" style={{ color: TEXT }}>
            Upload Dataset
          </h2>
        </div>
        <div className="p-4 space-y-3">
          <button
            type="button"
            className="w-full rounded-lg p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200"
            style={{
              border: `2px dashed ${dragging ? ACCENT : "rgba(0,212,255,0.3)"}`,
              background: dragging
                ? "rgba(0,212,255,0.06)"
                : "rgba(0,212,255,0.02)",
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            data-ocid="dataset.dropzone"
          >
            {parsing ? (
              <div className="flex flex-col items-center gap-2">
                <svg
                  className="animate-spin"
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <span className="text-sm" style={{ color: MUTED }}>
                  Parsing CSV file…
                </span>
              </div>
            ) : (
              <>
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={dragging ? ACCENT : MUTED}
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <div className="text-center">
                  <p
                    className="text-sm font-medium"
                    style={{ color: dragging ? ACCENT : TEXT }}
                  >
                    Drag and drop a CSV file here
                  </p>
                  <p className="text-xs mt-1" style={{ color: MUTED }}>
                    or click to browse — accepts .csv files only
                  </p>
                </div>
                <span
                  className="px-3 py-1.5 rounded text-xs font-semibold"
                  style={{
                    background: "rgba(0,212,255,0.15)",
                    color: ACCENT,
                    border: "1px solid rgba(0,212,255,0.3)",
                  }}
                >
                  Select File
                </span>
              </>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileInput}
            data-ocid="dataset.upload_button"
          />

          {/* Required columns hint */}
          <div
            className="p-3 rounded"
            style={{
              background: "rgba(0,212,255,0.05)",
              border: "1px solid rgba(0,212,255,0.15)",
            }}
          >
            <p className="text-xs font-medium mb-1" style={{ color: ACCENT }}>
              Required columns:
            </p>
            <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
              {REQUIRED_COLUMNS.join(", ")}
            </p>
          </div>

          {errorLines.length > 0 && (
            <div
              className="p-3 rounded"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
              }}
              data-ocid="dataset.error_state"
            >
              {errorLines.map((line, i) => (
                <p
                  key={line}
                  className="text-xs font-mono"
                  style={{ color: "#fca5a5", marginLeft: i > 0 ? "8px" : "0" }}
                >
                  {line}
                </p>
              ))}
            </div>
          )}

          {successMsg && (
            <div
              className="p-3 rounded flex items-center gap-2"
              style={{
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.3)",
              }}
              data-ocid="dataset.success_state"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={SUCCESS}
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <p className="text-xs" style={{ color: "#86efac" }}>
                {successMsg}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Dataset List */}
      <div
        className="rounded-xl"
        style={{ background: PANEL, border: `1px solid ${BORDER}` }}
      >
        <div
          className="p-4 border-b flex items-center justify-between"
          style={{ borderColor: BORDER }}
        >
          <h2 className="text-sm font-semibold" style={{ color: TEXT }}>
            Uploaded Datasets
          </h2>
          <span
            className="px-2 py-0.5 rounded text-xs"
            style={{ background: "rgba(0,212,255,0.1)", color: ACCENT }}
          >
            {datasets.length} total
          </span>
        </div>

        {datasets.length === 0 ? (
          <div
            className="p-12 flex flex-col items-center gap-3"
            data-ocid="dataset.empty_state"
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke={MUTED}
              strokeWidth="1.2"
              aria-hidden="true"
            >
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
              <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
            </svg>
            <p className="text-sm font-medium" style={{ color: MUTED }}>
              No datasets uploaded yet
            </p>
            <p className="text-xs" style={{ color: "#334155" }}>
              Upload a CSV file to get started with AI model training
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto" data-ocid="dataset.list">
            <table className="w-full text-sm">
              <thead>
                <tr
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    borderBottom: `1px solid ${BORDER}`,
                  }}
                >
                  {["Name", "Rows", "Columns", "Uploaded", "Actions"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                        style={{ color: MUTED }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {datasets.map((ds, idx) => (
                  <tr
                    key={ds.id}
                    className="cursor-pointer"
                    style={{
                      borderBottom: `1px solid ${BORDER}`,
                      background:
                        selectedId === ds.id
                          ? "rgba(0,212,255,0.06)"
                          : "transparent",
                    }}
                    onClick={() =>
                      setSelectedId(selectedId === ds.id ? null : ds.id)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        setSelectedId(selectedId === ds.id ? null : ds.id);
                    }}
                    data-ocid={`dataset.item.${idx + 1}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={ACCENT}
                          strokeWidth="2"
                          aria-hidden="true"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span className="font-medium" style={{ color: TEXT }}>
                          {ds.name}
                        </span>
                        {selectedId === ds.id && (
                          <span
                            className="px-1.5 py-0.5 rounded text-xs"
                            style={{
                              background: "rgba(0,212,255,0.15)",
                              color: ACCENT,
                            }}
                          >
                            Selected
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className="px-4 py-3 font-mono text-right"
                      style={{ color: "#94a3b8" }}
                    >
                      {ds.rowCount.toLocaleString()}
                    </td>
                    <td
                      className="px-4 py-3 font-mono text-right"
                      style={{ color: "#94a3b8" }}
                    >
                      {ds.columns.length}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: MUTED }}>
                      {new Date(ds.uploadedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDataset(ds.id);
                          if (selectedId === ds.id) setSelectedId(null);
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors duration-150"
                        style={{
                          background: "rgba(239,68,68,0.1)",
                          color: "#fca5a5",
                          border: "1px solid rgba(239,68,68,0.25)",
                        }}
                        data-ocid={`dataset.delete_button.${idx + 1}`}
                      >
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-hidden="true"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4h6v2" />
                        </svg>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Preview Panel */}
      {selectedDataset && (
        <div
          className="rounded-xl"
          style={{ background: PANEL, border: `1px solid ${BORDER}` }}
          data-ocid="dataset.panel"
        >
          <div className="p-4 border-b" style={{ borderColor: BORDER }}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: TEXT }}>
                  Preview — {selectedDataset.name}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                  Showing first 10 of{" "}
                  {selectedDataset.rowCount.toLocaleString()} rows
                </p>
              </div>
              <div className="flex items-center gap-4">
                <StatBadge
                  label="Total Rows"
                  value={selectedDataset.rowCount.toLocaleString()}
                  color={ACCENT}
                />
                <StatBadge
                  label="Columns"
                  value={String(selectedDataset.columns.length)}
                  color="#a78bfa"
                />
                {riskDist && (
                  <>
                    <StatBadge
                      label="Low Risk %"
                      value={`${riskDist.low}%`}
                      color={SUCCESS}
                    />
                    <StatBadge
                      label="High Risk %"
                      value={`${riskDist.high}%`}
                      color={DANGER}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto p-4">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {selectedDataset.columns.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2 text-left whitespace-nowrap uppercase tracking-wide"
                      style={{ color: ACCENT }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedDataset.rows.slice(0, 10).map((row, i) => {
                  const rowKey = selectedDataset.columns
                    .map(
                      (col) =>
                        (row as unknown as Record<string, string | number>)[
                          col
                        ],
                    )
                    .join("|");
                  return (
                    <tr
                      key={rowKey || `preview-row-${i}`}
                      style={{
                        borderBottom: "1px solid rgba(30,45,69,0.5)",
                        background:
                          i % 2 === 0
                            ? "transparent"
                            : "rgba(255,255,255,0.015)",
                      }}
                      data-ocid={`dataset.row.${i + 1}`}
                    >
                      {selectedDataset.columns.map((col) => {
                        const val = (
                          row as unknown as Record<string, string | number>
                        )[col];
                        const isRisk = col === "risk_label";
                        const isLow =
                          isRisk && String(val).toLowerCase().includes("low");
                        return (
                          <td
                            key={col}
                            className="px-3 py-2 whitespace-nowrap"
                            style={{
                              color: isRisk
                                ? isLow
                                  ? SUCCESS
                                  : DANGER
                                : "#94a3b8",
                            }}
                          >
                            {String(val ?? "")}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
