/**
 * Layout.tsx — Main app shell: header (scan status, nav) + main content + footer.
 * Single timer lives here (wraps every page) using useStore.
 */
import { Link, useLocation } from "@tanstack/react-router";
import {
  Activity,
  Bell,
  History,
  Save,
  Settings,
  Share2,
  User,
  UserPlus,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useScanTimer } from "../hooks/useScanTimer";
import { selectCurrentPatient, useStore } from "../store/useStore";

const navItems = [
  { path: "/", label: "Dashboard", Icon: Activity },
  { path: "/new-patient", label: "New Patient", Icon: UserPlus },
  { path: "/history", label: "History", Icon: History },
] as const;

export function Layout({ children }: { children: ReactNode }) {
  const patients = useStore((s) => s.patients);
  const currentPatientId = useStore((s) => s.currentPatientId);
  const setCurrentPatientId = useStore((s) => s.setCurrentPatientId);
  const scanActive = useStore((s) => s.scanActive);
  const toggleScan = useStore((s) => s.toggleScan);
  const incrementScanSeconds = useStore((s) => s.incrementScanSeconds);
  const currentPatient = useStore(selectCurrentPatient);
  const { formattedDuration } = useScanTimer();
  const location = useLocation();
  const pathname = location.pathname;

  // Single global scan timer — runs only when scan is active
  useEffect(() => {
    if (!scanActive) return;
    const interval = setInterval(() => incrementScanSeconds(), 1000);
    return () => clearInterval(interval);
  }, [scanActive, incrementScanSeconds]);

  return (
    <div
      className="flex flex-col h-screen overflow-hidden dark"
      style={{ background: "#0a0e1a", color: "#e8eaf0" }}
    >
      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <header
        className="flex items-center gap-3 px-4 py-2 border-b shrink-0 z-30"
        style={{
          background: "#0d1220",
          borderColor: "rgba(0,212,255,0.14)",
          height: "52px",
        }}
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #00d4ff, #0066aa)" }}
          >
            <Activity size={14} className="text-white" />
          </div>
          <span
            className="font-display font-bold text-sm tracking-wide"
            style={{ color: "#00d4ff" }}
          >
            VASCUSCAN{" "}
            <span
              className="font-normal"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              AI
            </span>
          </span>
        </Link>

        {/* Patient selector */}
        <select
          value={currentPatientId}
          onChange={(e) => setCurrentPatientId(e.target.value)}
          className="text-xs rounded px-2 py-1 outline-none border cursor-pointer font-mono"
          style={{
            background: "#131928",
            borderColor: "rgba(0,212,255,0.2)",
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

        {/* Scan status */}
        <div
          className="flex items-center gap-2 px-3 py-1 rounded border ml-1"
          style={{ background: "#131928", borderColor: "rgba(0,212,255,0.15)" }}
        >
          <span
            className="text-xs font-mono"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Scan Status
          </span>
          {scanActive ? (
            <>
              <span
                className="flex items-center gap-1 text-xs font-mono"
                style={{ color: "#00d4ff" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                Scanning… {formattedDuration}
              </span>
              <button
                type="button"
                onClick={toggleScan}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold"
                style={{ background: "#cc2222", color: "white" }}
                data-ocid="stop-scan-btn"
              >
                <span className="w-2 h-2 rounded-sm bg-white inline-block" />{" "}
                STOP
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={toggleScan}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold"
              style={{
                background: "rgba(0,212,255,0.18)",
                color: "#00d4ff",
                border: "1px solid rgba(0,212,255,0.3)",
              }}
              data-ocid="start-scan-btn"
            >
              ▶ START
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-1 ml-3">
          {navItems.map(({ path, label, Icon }) => (
            <Link
              key={path}
              to={path}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-smooth"
              style={{
                color: pathname === path ? "#00d4ff" : "rgba(255,255,255,0.5)",
                background:
                  pathname === path ? "rgba(0,212,255,0.1)" : "transparent",
              }}
            >
              <Icon size={12} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {(
            [
              ["Save", Save],
              ["Settings", Settings],
              ["Share", Share2],
              ["Notifications", Bell],
              ["Account", User],
            ] as const
          ).map(([label, Icon]) => (
            <button
              key={label}
              type="button"
              className="p-1.5 rounded transition-smooth hover:bg-white/5"
              style={{ color: "rgba(255,255,255,0.45)" }}
              aria-label={label}
            >
              <Icon size={15} />
            </button>
          ))}
          <Link
            to="/new-patient"
            className="flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold ml-2 transition-smooth"
            style={{
              background: "rgba(0,212,255,0.18)",
              color: "#00d4ff",
              border: "1px solid rgba(0,212,255,0.3)",
            }}
            data-ocid="new-patient-btn"
          >
            <UserPlus size={12} /> New Patient
          </Link>
        </div>

        {/* Quick patient info */}
        {currentPatient && (
          <div
            className="hidden lg:flex items-center gap-2 ml-2 px-2 py-1 rounded border text-xs"
            style={{
              borderColor: "rgba(0,212,255,0.1)",
              background: "#111827",
            }}
          >
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
              style={{ background: currentPatient.avatarColor }}
            >
              {currentPatient.initials}
            </div>
            <span
              className="font-medium truncate max-w-24"
              style={{ color: "#e8eaf0" }}
            >
              {currentPatient.fullName}
            </span>
            <span
              className="font-mono text-[10px]"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              {currentPatient.id}
            </span>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-hidden">{children}</main>

      {/* ─── Footer ──────────────────────────────────────────────────────────── */}
      <footer
        className="shrink-0 flex items-center justify-center py-1 text-[10px]"
        style={{
          color: "rgba(255,255,255,0.2)",
          background: "#0a0e1a",
          borderTop: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        © {new Date().getFullYear()}. Built with love using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-1 hover:text-white/40 transition-colors"
        >
          caffeine.ai
        </a>
      </footer>
    </div>
  );
}
