import { useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import type { Patient } from "../types";
import { Trash2, AlertTriangle, ArrowUpDown, Download, FileText, ChevronLeft } from "lucide-react";

const riskPriority = { "High": 3, "Moderate": 2, "Low": 1, "Unknown": 0 };

const riskStyle = (r: string) => {
  const upper = r.toUpperCase();
  if (upper === "HIGH")
    return { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.4)", text: "#ef4444" };
  if (upper === "MODERATE" || upper === "MODERATE RISK")
    return { bg: "rgba(249,115,22,0.15)", border: "rgba(249,115,22,0.4)", text: "#f97316" };
  return { bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.4)", text: "#22c55e" };
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch { return iso; }
}

export default function History() {
  const navigate = useNavigate();
  const allPatients = useStore((s) => s.patients);
  const deletePatient = useStore((s) => s.deletePatient);
  
  const [sortKey, setSortKey] = useState<"time" | "risk">("time");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sortedPatients = useMemo(() => {
    return [...allPatients].sort((a, b) => {
      if (sortKey === "time") {
        const tA = new Date(a.createdAt || 0).getTime();
        const tB = new Date(b.createdAt || 0).getTime();
        return sortDir === "desc" ? tB - tA : tA - tB;
      } else {
        const rA = riskPriority[a.riskAssessment?.riskLevel as keyof typeof riskPriority] || 0;
        const rB = riskPriority[b.riskAssessment?.riskLevel as keyof typeof riskPriority] || 0;
        return sortDir === "desc" ? rB - rA : rA - rB;
      }
    });
  }, [allPatients, sortKey, sortDir]);

  const toggleSort = (key: "time" | "risk") => {
    if (sortKey === key) setSortDir(s => s === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-[#e2e8f0] font-[Figtree]">
      {/* Header Area */}
      <div className="border-b border-[#1a2744] bg-[#0d1220] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate({ to: "/" })}
            className="p-2 rounded-full hover:bg-white/5 transition-colors text-[#64748b] hover:text-[#00d4ff]"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Clinical History</h1>
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-widest mt-0.5">Global Patient Records</p>
          </div>
        </div>
        
        <div className="flex gap-2">
           <button className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#1a2744] text-xs font-semibold hover:bg-[#23355a] transition-colors border border-white/5">
              <Download size={14} /> Export CSV
           </button>
           <button className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#00d4ff] text-black text-xs font-bold hover:brightness-110 transition-colors">
              <FileText size={14} /> Full PDF Report
           </button>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-[#0d1426] border border-[#1a2744] rounded-xl overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1a2744] bg-[#11182d]">
                <th className="px-6 py-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">Patient Details</th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-[#64748b] uppercase tracking-wider cursor-pointer hover:text-[#00d4ff] transition-colors"
                  onClick={() => toggleSort("time")}
                >
                  <div className="flex items-center gap-2">
                    Date & Time {sortKey === "time" && <ArrowUpDown size={12} className="text-[#00d4ff]" />}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-[#64748b] uppercase tracking-wider cursor-pointer hover:text-[#00d4ff] transition-colors"
                  onClick={() => toggleSort("risk")}
                >
                  <div className="flex items-center gap-2">
                    Risk Level {sortKey === "risk" && <ArrowUpDown size={12} className="text-[#00d4ff]" />}
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-[#64748b] uppercase tracking-wider text-center">Blockage</th>
                <th className="px-6 py-4 text-xs font-bold text-[#64748b] uppercase tracking-wider text-center">AI Conf.</th>
                <th className="px-6 py-4 text-xs font-bold text-[#64748b] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a2744]">
              {sortedPatients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-40">
                      <Trash2 size={40} />
                      <p className="text-sm font-medium">No patient records found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedPatients.map((pt) => {
                  const rs = riskStyle(pt.riskAssessment?.riskLevel || "Low");
                  return (
                    <tr key={pt.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-white font-semibold">{pt.fullName}</span>
                          <span className="text-[10px] text-[#64748b] font-mono mt-0.5 tracking-tighter uppercase">{pt.id}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#94a3b8] font-mono">
                        {formatDate(pt.createdAt || "")}
                      </td>
                      <td className="px-6 py-4">
                        <span 
                          className="px-2.5 py-1 rounded text-[10px] font-black border uppercase tracking-widest"
                          style={{ background: rs.bg, borderColor: rs.border, color: rs.text }}
                        >
                          {pt.riskAssessment?.riskLevel || "LOW"} Risk
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-orange-400 font-bold font-mono">{pt.riskAssessment?.blockageProbability || 0}%</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-[#00d4ff] font-bold font-mono">{pt.riskAssessment?.aiConfidence || 0}%</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => confirm(`Permanently delete records for ${pt.fullName}?`) && deletePatient(pt.id)}
                          className="p-2 rounded hover:bg-red-500/10 text-[#475569] hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Aggregate Insight Card */}
        {sortedPatients.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="bg-[#0d1426] border border-[#1a2744] p-4 rounded-xl flex items-center gap-4">
                <div className="w-10 h-10 rounded bg-[#ef4444]/10 flex items-center justify-center text-red-500">
                   <AlertTriangle size={20} />
                </div>
                <div>
                   <p className="text-xs text-[#64748b] uppercase font-bold tracking-wider">Critical Cases</p>
                   <p className="text-xl font-bold text-white">{sortedPatients.filter(p => p.riskAssessment?.riskLevel === "High").length}</p>
                </div>
             </div>
             
             <div className="bg-[#0d1426] border border-[#1a2744] p-4 rounded-xl flex items-center gap-4">
                <div className="w-10 h-10 rounded bg-[#00d4ff]/10 flex items-center justify-center text-[#00d4ff]">
                   <FileText size={20} />
                </div>
                <div>
                   <p className="text-xs text-[#64748b] uppercase font-bold tracking-wider">Total Scans</p>
                   <p className="text-xl font-bold text-white">{sortedPatients.length}</p>
                </div>
             </div>

             <div className="bg-[#0d1426] border border-[#1a2744] p-4 rounded-xl flex items-center gap-4">
                <div className="w-10 h-10 rounded bg-[#22c55e]/10 flex items-center justify-center text-green-500">
                   <Download size={20} />
                </div>
                <div>
                   <p className="text-xs text-[#64748b] uppercase font-bold tracking-wider">System Coverage</p>
                   <p className="text-xl font-bold text-white">100.0%</p>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
