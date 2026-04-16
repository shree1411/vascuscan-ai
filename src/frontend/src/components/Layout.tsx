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
import { Header } from "./Header";
import { useConnectionPolling } from "../hooks/useConnectionPolling";

const navItems = [
  { path: "/", label: "Dashboard", Icon: Activity },
  { path: "/new-patient", label: "New Patient", Icon: UserPlus },
  { path: "/history", label: "History", Icon: History },
] as const;

export function Layout({ children }: { children: ReactNode }) {
  useConnectionPolling(); // Core hardware listener
  
  return (
    <div
      className="flex flex-col h-screen overflow-hidden dark"
      style={{ background: "#0a0e1a", color: "#e8eaf0" }}
    >
      <Header />

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
