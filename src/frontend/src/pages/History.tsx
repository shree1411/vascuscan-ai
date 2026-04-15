import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "../store/useStore";
import type { Patient, ScanSession } from "../types";

const riskStyle = (r: string) => {
  const upper = r.toUpperCase();
  if (upper === "HIGH")
    return {
      bg: "rgba(239,68,68,0.15)",
      border: "rgba(239,68,68,0.4)",
      text: "#ef4444",
    };
  if (upper === "MODERATE" || upper === "MODERATE RISK")
    return {
      bg: "rgba(249,115,22,0.15)",
      border: "rgba(249,115,22,0.4)",
      text: "#f97316",
    };
  return {
    bg: "rgba(34,197,94,0.15)",
    border: "rgba(34,197,94,0.4)",
    text: "#22c55e",
  };
};

function formatDuration(seconds: number): string {
  if (seconds === 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildCSV(patients: Patient[]): string {
  const header =
    "Date,PatientID,PatientName,RiskLevel,BlockageProbability(%),AIConfidence(%)";
  const rows = patients.map((p) =>
    [
      formatDate(p.createdAt ?? new Date().toISOString()),
      p.id,
      p.fullName,
      p.riskAssessment?.riskLevel ?? "Unknown",
      p.riskAssessment?.blockageProbability ?? 0,
      p.riskAssessment?.aiConfidence ?? 0,
    ].join(","),
  );
  return [header, ...rows].join("\n");
}

export default function History() {
  const navigate = useNavigate();
  const allPatients = useStore((s) => s.patients);
  const deletePatient = useStore((s) => s.deletePatient);
  const [filterMode, setFilterMode] = useState<"time"|"High"|"Moderate"|"Low">("time");

  const filtered = [...allPatients].sort((a, b) => {
      if (filterMode === "time") {
          return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
      }
      return 0; // The logic for filtering comes after sorting.
  });
  
  const displayed = filterMode === "time" ? filtered : filtered.filter(p => p.riskAssessment?.riskLevel === filterMode);

  const handleCSV = () => {
    if (displayed.length === 0) return;
    downloadFile(
      buildCSV(displayed),
      "vascuscan-history.csv",
      "text/csv",
    );
  };

  const handleJSON = () => {
    if (displayed.length === 0) return;
    const data = {
      exportedAt: new Date().toISOString(),
      patients: displayed,
    };
    downloadFile(
      JSON.stringify(data, null, 2),
      "vascuscan-history.json",
      "application/json",
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] p-6" data-ocid="history-page">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="text-[#00d4ff] text-sm hover:text-white transition-smooth"
            data-ocid="history-back-btn"
          >
            ← Back
          </button>
          <div>
            <h1 className="text-white font-bold text-lg tracking-wide">
              GLOBAL PATIENT HISTORY
            </h1>
            <p className="text-[#64748b] text-sm">
              All saved patient predictions
            </p>
          </div>
        </div>

        {/* Export buttons */}
        <div className="flex gap-2" data-ocid="history-export-row">
          <button
            type="button"
            onClick={() => window.alert("PDF export coming soon.")}
            className="bg-[#00d4ff] text-black text-xs font-semibold px-3 py-2 rounded transition-smooth hover:opacity-90"
            data-ocid="history-export-pdf"
          >
            📄 PDF Report
          </button>
          <button
            type="button"
            onClick={handleCSV}
            disabled={sessions.length === 0}
            className="bg-[#1a2744] text-white text-xs font-semibold px-3 py-2 rounded transition-smooth hover:bg-[#223060] disabled:opacity-40 disabled:cursor-not-allowed"
            data-ocid="history-export-csv"
          >
            📊 CSV Export
          </button>
          <button
            type="button"
            onClick={handleJSON}
            disabled={sessions.length === 0}
            className="bg-[#1a2744] text-white text-xs font-semibold px-3 py-2 rounded transition-smooth hover:bg-[#223060] disabled:opacity-40 disabled:cursor-not-allowed"
            data-ocid="history-export-json"
          >
            {"{ }"} JSON Export
          </button>
        </div>
      </div>

      <div className="mb-6 flex justify-between items-end border-b border-[#1a2744] pb-4" data-ocid="history-sessions">
        <div>
           <p className="text-[#64748b] text-xs uppercase tracking-wider mb-2 font-semibold">
           History Records ({displayed.length})
           </p>
           <div className="flex gap-2">
              <select 
                 className="bg-[#0a0e1a] border border-[#1a2744] rounded px-3 py-1.5 text-white text-sm outline-none"
                 value={filterMode}
                 onChange={(e) => setFilterMode(e.target.value as any)}
              >
                  <option value="time">Sort by Time (Most Recent)</option>
                  <option value="High">Filter by High Risk</option>
                  <option value="Moderate">Filter by Moderate Risk</option>
                  <option value="Low">Filter by Low Risk</option>
              </select>
           </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {displayed.length === 0 ? (
          <div
            className="bg-[#0d1426] border border-[#1a2744] rounded-lg p-10 flex flex-col items-center justify-center gap-3"
            data-ocid="history-sessions.empty_state"
          >
            <span className="text-4xl opacity-30">📋</span>
            <p className="text-[#64748b] text-sm text-center">
              No scan sessions yet.
            </p>
            <p className="text-[#475569] text-xs text-center">
              Complete a scan or register a patient to see results here.
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/" })}
              className="mt-2 px-4 py-2 rounded text-xs font-semibold bg-[#00d4ff] text-black hover:opacity-90 transition-smooth"
              data-ocid="history-go-dashboard-btn"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          displayed.map((pt, idx) => {
            const riskObj = pt.riskAssessment;
            const level = riskObj?.riskLevel ?? "Unknown";
            const rs = riskStyle(level);
            return (
              <div
                key={pt.id}
                className="bg-[#0d1426] border border-[#1a2744] rounded-lg p-4 flex flex-wrap items-center gap-4 transition-colors hover:border-[#2a3a5a]"
              >
                {/* Date + duration */}
                <div className="min-w-[140px]">
                  <p className="text-[#00d4ff] font-semibold text-sm">
                    {formatDate(pt.createdAt ?? "")}
                  </p>
                  <p className="text-[#64748b] text-xs mt-0.5 font-mono">
                    {pt.id}
                  </p>
                </div>
                
                {/* Name */}
                <div className="min-w-[150px]">
                  <p className="text-white font-medium">{pt.fullName}</p>
                </div>

                {/* Risk badge */}
                <div
                  className="px-3 py-1 rounded text-xs font-bold border"
                  style={{
                    background: rs.bg,
                    borderColor: rs.border,
                    color: rs.text,
                  }}
                >
                  {level.toUpperCase()} RISK
                </div>

                {/* Blockage + confidence */}
                <div className="flex gap-3 flex-wrap">
                  <span className="bg-[#0a0e1a] border border-[#1a2744] rounded px-2 py-1 text-xs">
                    <span className="text-[#64748b]">Blockage: </span>
                    <span className="text-orange-400 font-semibold">
                      {riskObj?.blockageProbability ?? 0}%
                    </span>
                  </span>
                  <span className="bg-[#0a0e1a] border border-[#1a2744] rounded px-2 py-1 text-xs">
                    <span className="text-[#64748b]">AI Conf: </span>
                    <span className="text-[#00d4ff] font-semibold">
                      {riskObj?.aiConfidence ?? 0}%
                    </span>
                  </span>
                </div>
                
                <div className="ml-auto">
                   <button
                       onClick={() => confirm(`Delete patient ${pt.fullName}?`) && deletePatient(pt.id)}
                       className="px-3 py-1 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded hover:bg-red-400/20"
                   >
                       Delete
                   </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Vital Sign Trends */}
      {displayed.length > 0 && (
        <div
          className="bg-[#0d1426] border border-[#1a2744] rounded-lg p-5"
          data-ocid="history-trends"
        >
          <p className="text-white font-bold text-sm uppercase tracking-wide mb-4">
            VITAL SIGN TRENDS
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-amber-400 text-lg font-bold">↑</span>
              <div>
                <p className="text-amber-400 text-sm font-semibold">
                  Blood Pressure
                </p>
                <p className="text-[#64748b] text-xs">
                  Slightly elevated trend over {displayed.length} patient
                  {displayed.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-green-400 text-lg font-bold">→</span>
              <div>
                <p className="text-green-400 text-sm font-semibold">
                  Heart Rate
                </p>
                <p className="text-[#64748b] text-xs">
                  Avg{" "}
                  {Math.round(
                    displayed.reduce((a, s) => a + (s.vitals?.heartRate ?? 72), 0) /
                      displayed.length,
                  )}{" "}
                  BPM across recorded patients
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[#00d4ff] text-lg font-bold">↑</span>
              <div>
                <p className="text-[#00d4ff] text-sm font-semibold">
                  AI Confidence
                </p>
                <p className="text-[#64748b] text-xs">
                  Latest:{" "}
                  {displayed[displayed.length - 1].riskAssessment?.aiConfidence ?? 0}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
