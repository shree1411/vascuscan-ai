/**
 * Header.tsx — Full-width top bar with logo, patient selector, scan status, and actions.
 */
import { useNavigate } from "@tanstack/react-router";
import {
  Activity,
  CheckCircle,
  Database,
  Download,
  History,
  Save,
  Settings,
  Share2,
  Square,
  UserPlus,
  Bell,
  X,
  Clipboard,
  FileJson,
  Mail,
  FileBarChart,
  CircleCheck,
  LayoutDashboard,
  UserCircle,
  LogOut,
  FileText
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useStore, selectCurrentPatient } from "../store/useStore";
import type { ScanSession } from "../types";

function fmtSeconds(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/* ── Toast system ── */
type ToastType = "success" | "error";
interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

let toastCounter = 0;

function ToastContainer({
  toasts,
  onDismiss,
}: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium pointer-events-auto"
          style={{
            background: t.type === "success" ? "#0f2b1a" : "#2b0f0f",
            border: `1px solid ${t.type === "success" ? "#16a34a" : "#dc2626"}`,
            color: t.type === "success" ? "#4ade80" : "#f87171",
            minWidth: "240px",
          }}
          data-ocid="header.toast"
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: t.type === "success" ? "#4ade80" : "#f87171" }}
          />
          <span className="flex-1">{t.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function Header() {
  const navigate = useNavigate();
  const patients = useStore((s) => s.patients);
  const currentPatientId = useStore((s) => s.currentPatientId);
  const setCurrentPatientId = useStore((s) => s.setCurrentPatientId);
  const scanActive = useStore((s) => s.scanActive);
  const scanSeconds = useStore((s) => s.scanSeconds);
  const toggleScan = useStore((s) => s.toggleScan);
  const incrementScanSeconds = useStore((s) => s.incrementScanSeconds);
  const vitals = useStore((s) => s.vitals);
  const addScanSession = useStore((s) => s.addScanSession);
  const patient = useStore(selectCurrentPatient);
  const notifications = useStore((s) => s.notifications);
  const addNotification = useStore((s) => s.addNotification);
  const clearNotifications = useStore((s) => s.clearNotifications);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const timerRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  
  const [showSettings, setShowSettings] = useState(false);
  const [comPortInput, setComPortInput] = useState("COM3");

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timerRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timerRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "success") => {
      toastCounter += 1;
      const id = toastCounter;
      setToasts((prev) => [...prev, { id, message, type }]);
      const timer = setTimeout(() => dismissToast(id), 3000);
      timerRef.current.set(id, timer);
    },
    [dismissToast],
  );

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = timerRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
    };
  }, []);

  // Tick the scan timer
  useEffect(() => {
    if (!scanActive) return;
    const id = setInterval(() => incrementScanSeconds(), 1000);
    return () => clearInterval(id);
  }, [scanActive, incrementScanSeconds]);

  /* ── Stop scan + auto-save session ── */
  const handleStopScan = useCallback(() => {
    if (patient) {
      const session: ScanSession = {
        id: `session-${Date.now()}`,
        patientId: patient.id,
        startTime: new Date(Date.now() - scanSeconds * 1000).toISOString(),
        endTime: new Date().toISOString(),
        duration: scanSeconds,
        vitals: { ...vitals },
        ppgParams: patient.ppgParams ?? {
          heartRate: vitals.heartRate,
          pulseAmplitude: vitals.perfusionIndex,
          ptt: vitals.ptt,
          riseTime: 165,
        },
        ecgParams: patient.ecgParams ?? {
          qrsDuration: 92,
          rrInterval: Math.round(60000 / vitals.heartRate),
          stSegment: 0.08,
          hrvIndex: 42,
        },
        riskAssessment: { ...patient.riskAssessment },
      };
      addScanSession(patient.id, session);
      addNotification("Scan session auto-saved to history", "success");
    }
    toggleScan();
  }, [patient, scanSeconds, vitals, addScanSession, toggleScan, addNotification]);

  const handleStartScan = useCallback(() => {
    const sensorStatus = useStore.getState().sensorStatus;
    const isOffline = sensorStatus.ppg === "OFFLINE" && sensorStatus.ecg === "OFFLINE";
    
    if (isOffline) {
      addNotification("Cannot start scan: Sensors are OFFLINE. Please check connections.", "warning");
      showToast("Sensors Offline", "error");
      return;
    }

    toggleScan();
    addNotification("Scan started. Signals are preprocessing...", "info");
    showToast("Scanning started", "success");
  }, [toggleScan, addNotification, showToast]);

  /* ── Save handler ── */
  const handleSave = useCallback(() => {
    if (!patient) {
      showToast("No patient selected", "error");
      return;
    }
    const now = new Date().toISOString();
    const session: ScanSession = {
      id: `session-${Date.now()}`,
      patientId: patient.id,
      startTime: now,
      endTime: now,
      duration: scanSeconds,
      ppgParams: patient.ppgParams,
      ecgParams: patient.ecgParams,
      vitals: { ...vitals },
      riskAssessment: { ...patient.riskAssessment },
    };
    addScanSession(patient.id, session);
    showToast("Scan session saved", "success");
  }, [patient, scanSeconds, vitals, addScanSession, showToast]);

  /* ── Share/clipboard handler ── */
  const handleShare = useCallback(() => {
    if (!patient) {
      showToast("No patient selected", "error");
      return;
    }
    const ra = patient.riskAssessment;
    const bp = `${vitals.systolic}/${vitals.diastolic}`;
    const report = [
      "VASCUSCAN AI Patient Report",
      "─".repeat(40),
      `Patient: ${patient.fullName} | ID: ${patient.id}`,
      `Risk Level: ${ra.riskLevel} | Blockage: ${ra.blockageProbability}%`,
      `Heart Rate: ${vitals.heartRate} bpm | SpO2: ${vitals.spo2}% | BP: ${bp} mmHg`,
      `AI Confidence: ${ra.aiConfidence}%`,
      `Generated: ${new Date().toLocaleString()}`,
    ].join("\n");

    navigator.clipboard
      .writeText(report)
      .then(() => showToast("Report copied to clipboard", "success"))
      .catch(() => showToast("Clipboard access denied", "error"));
  }, [patient, vitals, showToast]);

  /* ── Download CSV handler ── */
  const handleDownload = useCallback(() => {
    if (!patient) {
      showToast("No patient selected", "error");
      return;
    }
    const ra = patient.riskAssessment;
    const dateStr = new Date().toISOString().split("T")[0];
    const bp = `${vitals.systolic}/${vitals.diastolic}`;

    const headers = [
      "Patient ID",
      "Name",
      "Age",
      "Gender",
      "Risk Level",
      "Blockage %",
      "AI Confidence",
      "Heart Rate",
      "SpO2",
      "Blood Pressure",
      "PTT",
      "Perfusion Index",
      "Scan Date",
    ];

    const mainRow = [
      patient.id,
      patient.fullName,
      patient.age,
      patient.gender,
      ra.riskLevel,
      ra.blockageProbability,
      ra.aiConfidence,
      vitals.heartRate,
      vitals.spo2,
      bp,
      vitals.ptt,
      vitals.perfusionIndex,
      dateStr,
    ];

    const sessionRows = (patient.scanSessions ?? []).map((s) => [
      patient.id,
      patient.fullName,
      patient.age,
      patient.gender,
      s.riskAssessment.riskLevel,
      s.riskAssessment.blockageProbability,
      s.riskAssessment.aiConfidence,
      s.vitals.heartRate,
      s.vitals.spo2,
      `${s.vitals.systolic}/${s.vitals.diastolic}`,
      s.vitals.ptt,
      s.vitals.perfusionIndex,
      s.startTime.split("T")[0],
    ]);

    const csvLines = [
      headers.join(","),
      mainRow.join(","),
      ...sessionRows.map((r) => r.join(",")),
    ].join("\n");

    const blob = new Blob([csvLines], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vascuscan-${patient.id}-${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Report downloaded", "success");
  }, [patient, vitals, showToast]);

  const handlePortChange = async () => {
     try {
       const res = await fetch("http://127.0.0.1:5000/api/set-port", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ port: comPortInput })
       });
       if (res.ok) {
           showToast(`Successfully switched to ${comPortInput}`, "success");
           setShowSettings(false);
       } else {
           showToast("Failed to switch port", "error");
       }
     } catch (e) {
         showToast("Backend not reachable", "error");
     }
  };

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <header
        className="flex items-center gap-3 px-4 shrink-0 z-30 border-b"
        style={{
          background: "#0d1220",
          borderColor: "#1a2744",
          height: "64px",
        }}
        data-ocid="app-header"
      >
        {/* ── Logo ── */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #00d4ff, #0066aa)" }}
          >
            <Activity size={14} className="text-white" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-sm text-white tracking-wide">
              VASCUSCAN AI
            </span>
            <span className="text-xs" style={{ color: "#64748b" }}>
              Blood Vessel Analysis System
            </span>
          </div>
        </div>

        {/* ── Patient selector ── */}
        <div className="flex items-center gap-2 ml-4">
          <select
            value={currentPatientId}
            onChange={(e) => setCurrentPatientId(e.target.value)}
            className="rounded px-3 py-1.5 text-sm border outline-none cursor-pointer"
            style={{
              background: "#131928",
              borderColor: "#1a2744",
              color: "#e8eaf0",
              minWidth: "220px",
            }}
            data-ocid="patient-selector"
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName} — {p.id}
              </option>
            ))}
          </select>
          {patient && (
            <span
              className="px-2 py-0.5 rounded text-xs font-medium border"
              style={{
                background: "#1a2744",
                color: "#94a3b8",
                borderColor: "#1a2744",
              }}
            >
              Age {patient.age}
            </span>
          )}
        </div>

        {/* ── Scan status ── */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded border"
          style={{ background: "#131928", borderColor: "#1a2744" }}
        >
          {scanActive ? (
            <>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-mono text-white">
                Scanning... {fmtSeconds(scanSeconds)}
              </span>
              <button
                type="button"
                onClick={handleStopScan}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold"
                style={{ background: "#cc2222", color: "white" }}
                data-ocid="stop-scan-btn"
              >
                <Square size={10} fill="white" />
                STOP SCAN
              </button>
            </>
          ) : (
            <>
              <CheckCircle size={14} className="text-green-500" />
              <span className="text-xs font-mono" style={{ color: "#22c55e" }}>
                Scan Complete
              </span>
              <button
                type="button"
                onClick={handleStartScan}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border"
                style={{
                  background: "rgba(0,212,255,0.1)",
                  color: "#00d4ff",
                  borderColor: "rgba(0,212,255,0.3)",
                }}
                data-ocid="start-scan-btn"
              >
                ▶ START
              </button>
            </>
          )}
        </div>

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── Action icon buttons ── */}
        <div className="flex items-center gap-1">
          {/* Notifications Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="p-1.5 rounded transition-smooth hover:bg-white/10 relative"
                style={{ color: "#64748b" }}
                aria-label="Notifications"
                title="System Notifications"
              >
                <Bell size={15} />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full border border-[#0d1220]" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-[#0d1220] border-[#1a2744] text-[#e2e8f0]">
              <div className="flex items-center justify-between px-2 py-1.5">
                <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wider text-[#64748b]">System Notifications</DropdownMenuLabel>
                <button onClick={clearNotifications} className="text-[10px] text-[#00d4ff] hover:underline">Clear</button>
              </div>
              <DropdownMenuSeparator className="bg-[#1a2744]" />
              <div className="max-h-60 overflow-y-auto scrollbar-thin">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-[#475569] text-xs">No new notifications</div>
                ) : (
                  notifications.map((n) => (
                    <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-1 p-3 focus:bg-white/5 cursor-default border-b border-white/5 last:border-0">
                      <div className="flex items-center gap-2 w-full">
                        <span className={`w-1.5 h-1.5 rounded-full ${n.type === 'warning' ? 'bg-orange-500' : n.type === 'success' ? 'bg-green-500' : 'bg-[#00d4ff]'}`} />
                        <span className="text-xs font-medium flex-1">{n.message}</span>
                        <span className="text-[9px] text-[#475569]">{n.timestamp}</span>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Save Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="p-1.5 rounded transition-smooth hover:bg-white/10"
                style={{ color: "#64748b" }}
                aria-label="Save Settings"
              >
                <Save size={15} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-[#0d1220] border-[#1a2744] text-[#e2e8f0]">
              <DropdownMenuItem onClick={handleSave} className="flex items-center gap-2 focus:bg-white/5">
                <CircleCheck size={14} className="text-green-500" /> <span>Quick Save</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addNotification("Save with Note opening...", "info")} className="flex items-center gap-2 focus:bg-white/5">
                <FileText size={14} className="text-[#00d4ff]" /> <span>Save with Note</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownload} className="flex items-center gap-2 focus:bg-white/5">
                <FileBarChart size={14} className="text-[#f97316]" /> <span>Export PDF</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Share Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="p-1.5 rounded transition-smooth hover:bg-white/10"
                style={{ color: "#64748b" }}
                aria-label="Share"
              >
                <Share2 size={15} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-[#0d1220] border-[#1a2744] text-[#e2e8f0]">
              <DropdownMenuItem onClick={handleShare} className="flex items-center gap-2 focus:bg-white/5">
                <Clipboard size={14} className="text-[#00d4ff]" /> <span>Copy Report</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(patient, null, 2));
                addNotification("JSON copied to clipboard", "success");
              }} className="flex items-center gap-2 focus:bg-white/5">
                <FileJson size={14} className="text-[#f97316]" /> <span>Copy JSON</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addNotification("Mock email sent", "success")} className="flex items-center gap-2 focus:bg-white/5">
                <Mail size={14} className="text-purple-400" /> <span>Email Link</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded transition-smooth hover:bg-white/10"
            style={{ color: "#64748b" }}
            aria-label="Settings"
            title="Settings"
          >
            <Settings size={15} />
          </button>

          <button
            type="button"
            onClick={() => navigate({ to: "/history" })}
            className={`p-1.5 rounded transition-smooth hover:bg-white/10 ${window.location.pathname === '/history' ? 'bg-white/5 text-[#00d4ff]' : ''}`}
            style={{ color: "#64748b" }}
            aria-label="History"
            title="View patient history"
          >
            <History size={15} />
          </button>

          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className={`p-1.5 rounded transition-smooth hover:bg-white/10 ${window.location.pathname === '/' ? 'bg-white/5 text-[#00d4ff]' : ''}`}
            style={{ color: "#64748b" }}
            aria-label="Dashboard"
            title="View dashboard"
          >
            <LayoutDashboard size={15} />
          </button>

          {/* Clinician Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="p-1.5 rounded transition-smooth hover:bg-white/10"
                style={{ color: "#64748b" }}
                aria-label="Clinician Profile"
              >
                <UserCircle size={15} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-[#0d1220] border-[#1a2744] text-[#e2e8f0]">
               <DropdownMenuLabel className="text-xs text-[#64748b]">CLINICIAN PROFILE</DropdownMenuLabel>
               <DropdownMenuSeparator className="bg-[#1a2744]" />
               <DropdownMenuItem className="flex items-center gap-2 focus:bg-white/5">
                 <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] uppercase">Dr</div>
                 <div className="flex flex-col">
                    <span className="text-xs font-bold">Dr. Admin</span>
                    <span className="text-[10px] text-[#64748b]">Senior Cardiologist</span>
                 </div>
               </DropdownMenuItem>
               <DropdownMenuSeparator className="bg-[#1a2744]" />
               <DropdownMenuItem onClick={() => showToast("Profile settings coming soon", "error")} className="flex items-center gap-2 focus:bg-white/5">
                 <Settings size={14} /> <span>Account Settings</span>
               </DropdownMenuItem>
               <DropdownMenuItem onClick={() => showToast("Logging out...", "error")} className="flex items-center gap-2 focus:bg-white/5 text-red-400">
                 <LogOut size={14} /> <span>Logout</span>
               </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={() => navigate({ to: "/new-patient" })}
            className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-semibold ml-2 transition-smooth hover:brightness-110 shadow-lg shadow-cyan-500/10"
            style={{ background: "#00d4ff", color: "#000" }}
            data-ocid="header-new-patient-btn"
          >
            <UserPlus size={13} />
            New Patient
          </button>
        </div>
      </header>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#0a0e1a] border border-[#1a2744] rounded-lg p-5 w-[360px] shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-white font-bold tracking-wide">SYSTEM SETTINGS</h3>
                  <button onClick={() => setShowSettings(false)} className="text-[#64748b] hover:text-white">
                      <X size={16} />
                  </button>
              </div>
              <div className="mb-5">
                  <label className="text-[#64748b] text-xs font-semibold uppercase mb-1.5 block">Arduino COM Port</label>
                  <input 
                      type="text" 
                      value={comPortInput}
                      onChange={(e) => setComPortInput(e.target.value)}
                      className="w-full bg-[#131928] border border-[#2a3a5a] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00d4ff]"
                      placeholder="e.g. COM3 or /dev/ttyUSB0"
                  />
                  <p className="text-xs text-[#475569] mt-2">Specify the port where the IoT sensors are connected.</p>
              </div>
              <div className="flex justify-end gap-2">
                  <button onClick={() => setShowSettings(false)} className="px-3 py-1.5 rounded text-sm text-[#94a3b8] hover:bg-[#1a2744] transition-colors">
                      Cancel
                  </button>
                  <button onClick={handlePortChange} className="px-4 py-1.5 rounded text-sm font-semibold bg-[#00d4ff] text-black hover:brightness-110">
                      Apply
                  </button>
              </div>
          </div>
        </div>
      )}
    </>
  );
}
